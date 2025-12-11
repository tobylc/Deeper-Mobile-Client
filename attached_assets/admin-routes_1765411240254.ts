import type { Express } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { users, connections, conversations, messages, emails } from "../shared/schema";
import { desc, count, sql, eq, and, gte, lte, isNotNull, or } from "drizzle-orm";
import { rateLimit } from "./middleware";
import { z } from "zod";

// Admin authentication middleware
const isAdmin = (req: any, res: any, next: any) => {
  const adminEmails = [
    'toby@gowithclark.com',
    'thetobyclarkshow@gmail.com', 
    'tobylc@mac.com'
  ];
  
  if (!req.user || !adminEmails.includes(req.user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

export function setupAdminRoutes(app: Express) {
  console.log('[ADMIN] Setting up admin routes...');

  // Admin dashboard stats
  app.get('/api/admin/stats', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // User stats
      const totalUsers = await db.select({ count: count() }).from(users);
      const activeUsers = await db.select({ count: count() }).from(users)
        .where(gte(users.updatedAt, thirtyDaysAgo));
      const newUsersToday = await db.select({ count: count() }).from(users)
        .where(gte(users.createdAt, oneDayAgo));
      const newUsersWeek = await db.select({ count: count() }).from(users)
        .where(gte(users.createdAt, sevenDaysAgo));
      
      // Subscription stats
      const subscriptionStats = await db.select({
        tier: users.subscriptionTier,
        count: count()
      }).from(users).groupBy(users.subscriptionTier);

      // Connection stats
      const totalConnections = await db.select({ count: count() }).from(connections);
      const acceptedConnections = await db.select({ count: count() }).from(connections)
        .where(eq(connections.status, 'accepted'));
      const pendingConnections = await db.select({ count: count() }).from(connections)
        .where(eq(connections.status, 'pending'));

      // Conversation stats
      const totalConversations = await db.select({ count: count() }).from(conversations);
      const activeConversations = await db.select({ count: count() }).from(conversations)
        .where(and(eq(conversations.status, 'active'), gte(conversations.lastActivityAt, sevenDaysAgo)));

      // Message stats
      const totalMessages = await db.select({ count: count() }).from(messages);
      const messagesWeek = await db.select({ count: count() }).from(messages)
        .where(gte(messages.createdAt, sevenDaysAgo));
      const messagesDay = await db.select({ count: count() }).from(messages)
        .where(gte(messages.createdAt, oneDayAgo));

      // Voice vs text message ratio
      const messageTypeStats = await db.select({
        format: messages.messageFormat,
        count: count()
      }).from(messages).groupBy(messages.messageFormat);

      // Email stats
      const emailStats = await db.select({
        type: emails.emailType,
        count: count()
      }).from(emails).groupBy(emails.emailType);

      // User engagement metrics
      const userEngagement = await db.execute(sql`
        SELECT 
          u.subscription_tier,
          COUNT(DISTINCT u.id) as user_count,
          AVG(user_messages.message_count) as avg_messages_per_user,
          AVG(user_conversations.conversation_count) as avg_conversations_per_user
        FROM users u
        LEFT JOIN (
          SELECT sender_email, COUNT(*) as message_count
          FROM messages
          GROUP BY sender_email
        ) user_messages ON u.email = user_messages.sender_email
        LEFT JOIN (
          SELECT participant1_email as email, COUNT(*) as conversation_count
          FROM conversations
          GROUP BY participant1_email
          UNION ALL
          SELECT participant2_email as email, COUNT(*) as conversation_count
          FROM conversations
          GROUP BY participant2_email
        ) user_conversations ON u.email = user_conversations.email
        GROUP BY u.subscription_tier
      `);

      res.json({
        users: {
          total: totalUsers[0].count,
          active: activeUsers[0].count,
          newToday: newUsersToday[0].count,
          newThisWeek: newUsersWeek[0].count,
          subscriptionBreakdown: subscriptionStats,
          engagement: userEngagement.rows
        },
        connections: {
          total: totalConnections[0].count,
          accepted: acceptedConnections[0].count,
          pending: pendingConnections[0].count,
          acceptanceRate: totalConnections[0].count > 0 ? 
            (acceptedConnections[0].count / totalConnections[0].count * 100).toFixed(1) : '0'
        },
        conversations: {
          total: totalConversations[0].count,
          active: activeConversations[0].count
        },
        messages: {
          total: totalMessages[0].count,
          thisWeek: messagesWeek[0].count,
          today: messagesDay[0].count,
          typeBreakdown: messageTypeStats
        },
        emails: {
          typeBreakdown: emailStats
        }
      });
    } catch (error) {
      console.error('[ADMIN] Stats error:', error);
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  // Daily activity chart data
  app.get('/api/admin/activity-chart', rateLimit(60, 50), isAdmin, async (req, res) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const dailyStats = await db.execute(sql`
        WITH date_series AS (
          SELECT generate_series(
            ${startDate.toISOString().split('T')[0]}::date,
            CURRENT_DATE,
            '1 day'::interval
          )::date as date
        ),
        daily_users AS (
          SELECT DATE(created_at) as date, COUNT(*) as new_users
          FROM users
          WHERE created_at >= ${startDate.toISOString()}
          GROUP BY DATE(created_at)
        ),
        daily_messages AS (
          SELECT DATE(created_at) as date, COUNT(*) as messages
          FROM messages
          WHERE created_at >= ${startDate.toISOString()}
          GROUP BY DATE(created_at)
        ),
        daily_connections AS (
          SELECT DATE(created_at) as date, COUNT(*) as connections
          FROM connections
          WHERE created_at >= ${startDate.toISOString()}
          GROUP BY DATE(created_at)
        )
        SELECT 
          ds.date,
          COALESCE(du.new_users, 0) as new_users,
          COALESCE(dm.messages, 0) as messages,
          COALESCE(dc.connections, 0) as connections
        FROM date_series ds
        LEFT JOIN daily_users du ON ds.date = du.date
        LEFT JOIN daily_messages dm ON ds.date = dm.date
        LEFT JOIN daily_connections dc ON ds.date = dc.date
        ORDER BY ds.date
      `);

      res.json(dailyStats.rows);
    } catch (error) {
      console.error('[ADMIN] Activity chart error:', error);
      res.status(500).json({ error: 'Failed to fetch activity data' });
    }
  });

  // User management - list with pagination and search
  app.get('/api/admin/users', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const search = req.query.search as string || '';
      const offset = (page - 1) * limit;

      const userList = await db.select().from(users)
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(users);

      res.json({
        users: userList,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      });
    } catch (error) {
      console.error('[ADMIN] Users list error:', error);
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  // User details with related data
  app.get('/api/admin/users/:userId', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;

      const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Get user's connections
      const userConnections = await db.select().from(connections)
        .where(or(
          eq(connections.inviterEmail, user[0].email!),
          eq(connections.inviteeEmail, user[0].email!)
        ))
        .orderBy(desc(connections.createdAt));

      // Get user's conversations
      const userConversations = await db.select().from(conversations)
        .where(or(
          eq(conversations.participant1Email, user[0].email!),
          eq(conversations.participant2Email, user[0].email!)
        ))
        .orderBy(desc(conversations.lastActivityAt));

      // Get user's messages
      const userMessages = await db.select().from(messages)
        .where(eq(messages.senderEmail, user[0].email!))
        .orderBy(desc(messages.createdAt))
        .limit(50);

      res.json({
        user: user[0],
        connections: userConnections,
        conversations: userConversations,
        messages: userMessages
      });
    } catch (error) {
      console.error('[ADMIN] User details error:', error);
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  });

  // Update user subscription
  app.patch('/api/admin/users/:userId/subscription', rateLimit(60, 20), isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { subscriptionTier, subscriptionStatus, maxConnections } = req.body;

      const tierLimits = {
        trial: 1,
        basic: 1,
        advanced: 3,
        unlimited: 999
      };

      const updateData: any = {};
      if (subscriptionTier) {
        updateData.subscriptionTier = subscriptionTier;
        updateData.maxConnections = tierLimits[subscriptionTier as keyof typeof tierLimits] || 1;
      }
      if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
      if (maxConnections !== undefined) updateData.maxConnections = maxConnections;

      await storage.updateUser(userId, updateData);

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Update subscription error:', error);
      res.status(500).json({ error: 'Failed to update subscription' });
    }
  });

  // Connection management
  app.get('/api/admin/connections', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      const connectionList = await db.select()
        .from(connections)
        .where(status ? eq(connections.status, status) : undefined)
        .orderBy(desc(connections.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(connections);

      res.json({
        connections: connectionList,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      });
    } catch (error) {
      console.error('[ADMIN] Connections list error:', error);
      res.status(500).json({ error: 'Failed to fetch connections' });
    }
  });

  // Message management with conversation context
  app.get('/api/admin/messages', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const offset = (page - 1) * limit;

      const messageList = await db.execute(sql`
        SELECT 
          m.*,
          c.participant1_email,
          c.participant2_email,
          c.relationship_type,
          c.title as conversation_title
        FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        ORDER BY m.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `);

      const totalCount = await db.select({ count: count() }).from(messages);

      res.json({
        messages: messageList.rows,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      });
    } catch (error) {
      console.error('[ADMIN] Messages list error:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // System health and performance metrics
  app.get('/api/admin/system-health', rateLimit(60, 30), isAdmin, async (req, res) => {
    try {
      // Database connection test
      const dbTest = await db.execute(sql`SELECT 1 as test`);
      const dbHealthy = dbTest.rows.length > 0;

      // Get database size and table stats
      const tableStats = await db.execute(sql`
        SELECT 
          schemaname,
          relname as tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_rows,
          n_dead_tup as dead_rows
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC
      `);

      // Get recent error patterns from logs (if implemented)
      const recentErrors = await db.execute(sql`
        SELECT 
          COUNT(*) as error_count,
          'recent_period' as timeframe
        FROM emails 
        WHERE status = 'failed' 
        AND sent_at >= NOW() - INTERVAL '24 hours'
      `);

      res.json({
        database: {
          healthy: dbHealthy,
          tables: tableStats.rows
        },
        errors: {
          recentEmailFailures: recentErrors.rows[0]?.error_count || 0
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('[ADMIN] System health error:', error);
      res.status(500).json({ error: 'Failed to check system health' });
    }
  });

  // Advanced analytics - user retention and engagement
  app.get('/api/admin/analytics/retention', rateLimit(60, 20), isAdmin, async (req, res) => {
    try {
      const retentionData = await db.execute(sql`
        WITH user_cohorts AS (
          SELECT 
            DATE_TRUNC('week', created_at) as cohort_week,
            id,
            email,
            created_at
          FROM users
          WHERE created_at >= NOW() - INTERVAL '12 weeks'
        ),
        user_activity AS (
          SELECT 
            sender_email,
            DATE_TRUNC('week', created_at) as activity_week
          FROM messages
          GROUP BY sender_email, DATE_TRUNC('week', created_at)
        )
        SELECT 
          uc.cohort_week,
          COUNT(DISTINCT uc.id) as cohort_size,
          COUNT(DISTINCT CASE 
            WHEN ua.activity_week = uc.cohort_week + INTERVAL '1 week' 
            THEN uc.email 
          END) as week_1_retained,
          COUNT(DISTINCT CASE 
            WHEN ua.activity_week = uc.cohort_week + INTERVAL '2 weeks' 
            THEN uc.email 
          END) as week_2_retained,
          COUNT(DISTINCT CASE 
            WHEN ua.activity_week = uc.cohort_week + INTERVAL '4 weeks' 
            THEN uc.email 
          END) as week_4_retained
        FROM user_cohorts uc
        LEFT JOIN user_activity ua ON uc.email = ua.sender_email
        GROUP BY uc.cohort_week
        ORDER BY uc.cohort_week
      `);

      res.json(retentionData.rows);
    } catch (error) {
      console.error('[ADMIN] Retention analytics error:', error);
      res.status(500).json({ error: 'Failed to fetch retention data' });
    }
  });

  // Debugging tools - recent errors and issues
  app.get('/api/admin/debug/recent-issues', rateLimit(60, 30), isAdmin, async (req, res) => {
    try {
      const issues = {
        failedEmails: await db.select().from(emails)
          .where(eq(emails.status, 'failed'))
          .orderBy(desc(emails.sentAt))
          .limit(20),
        
        expiredTrials: await db.select().from(users)
          .where(and(
            eq(users.subscriptionStatus, 'trial_expired'),
            isNotNull(users.trialExpiresAt)
          ))
          .orderBy(desc(users.trialExpiresAt))
          .limit(20),
          
        staleConnections: await db.select().from(connections)
          .where(and(
            eq(connections.status, 'pending'),
            sql`${connections.createdAt} < NOW() - INTERVAL '7 days'`
          ))
          .orderBy(desc(connections.createdAt))
          .limit(20)
      };

      res.json(issues);
    } catch (error) {
      console.error('[ADMIN] Debug issues error:', error);
      res.status(500).json({ error: 'Failed to fetch debug data' });
    }
  });

  // Database browser endpoints
  app.get('/api/admin/database/tables', rateLimit(60, 50), isAdmin, async (req, res) => {
    try {
      const tables = await db.execute(sql`
        SELECT 
          table_name as name,
          (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
        FROM information_schema.tables t
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      const tablesWithCounts = await Promise.all(
        tables.rows.map(async (table: any) => {
          try {
            const countResult = await db.execute(sql`SELECT COUNT(*) as count FROM ${sql.identifier(table.name as string)}`);
            return {
              name: table.name as string,
              rowCount: parseInt(String((countResult.rows[0] as any).count)),
              columns: []
            };
          } catch (error) {
            return {
              name: table.name,
              rowCount: 0,
              columns: []
            };
          }
        })
      );

      res.json(tablesWithCounts);
    } catch (error) {
      console.error('[ADMIN] Database tables error:', error);
      res.status(500).json({ error: 'Failed to fetch database tables' });
    }
  });

  app.get('/api/admin/database/table-data/:tableName', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const { tableName } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = 50;
      const offset = (page - 1) * limit;
      const search = req.query.search as string || '';

      // Get table columns
      const columns = await db.execute(sql`
        SELECT 
          column_name as name,
          data_type as type,
          is_nullable as nullable,
          column_default as default_value
        FROM information_schema.columns 
        WHERE table_name = ${tableName}
        ORDER BY ordinal_position
      `);

      // Build search query if provided
      let searchCondition = '';
      if (search) {
        const textColumns = columns.rows.filter((col: any) => 
          col.type.includes('text') || col.type.includes('varchar') || col.type.includes('char')
        );
        
        if (textColumns.length > 0) {
          const searchClauses = textColumns.map((col: any) => 
            `${col.name}::text ILIKE '%${search}%'`
          ).join(' OR ');
          searchCondition = `WHERE ${searchClauses}`;
        }
      }

      // Get total count
      const totalQuery = `SELECT COUNT(*) as count FROM ${tableName} ${searchCondition}`;
      const totalResult = await db.execute(sql.raw(totalQuery));
      const total = parseInt(String((totalResult.rows[0] as any).count));

      // Get paginated data
      const dataQuery = `SELECT * FROM ${tableName} ${searchCondition} ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`;
      const dataResult = await db.execute(sql.raw(dataQuery));

      res.json({
        columns: columns.rows.map((col: any) => ({
          name: col.name,
          type: col.type,
          nullable: col.nullable === 'YES',
          default: col.default_value
        })),
        rows: dataResult.rows,
        total,
        totalPages: Math.ceil(total / limit),
        page
      });
    } catch (error) {
      console.error('[ADMIN] Table data error:', error);
      res.status(500).json({ error: 'Failed to fetch table data' });
    }
  });

  app.patch('/api/admin/database/:tableName/:id', rateLimit(60, 20), isAdmin, async (req, res) => {
    try {
      const { tableName, id } = req.params;
      const updateData = req.body;

      // Remove read-only fields
      delete updateData.id;
      delete updateData.created_at;
      delete updateData.updated_at;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Build update query
      const setClause = Object.keys(updateData)
        .map(key => `${key} = $${Object.keys(updateData).indexOf(key) + 1}`)
        .join(', ');
      
      const values = Object.values(updateData);
      const query = `UPDATE ${tableName} SET ${setClause} WHERE id = $${values.length + 1}`;
      
      await db.execute(sql.raw(query));

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Update row error:', error);
      res.status(500).json({ error: 'Failed to update row' });
    }
  });

  app.delete('/api/admin/database/:tableName/:id', rateLimit(60, 10), isAdmin, async (req, res) => {
    try {
      const { tableName, id } = req.params;

      // Safety check - don't allow deletion of critical system tables
      const protectedTables = ['sessions'];
      if (protectedTables.includes(tableName)) {
        return res.status(403).json({ error: 'Cannot delete from protected table' });
      }

      await db.execute(sql`DELETE FROM ${sql.identifier(tableName)} WHERE id = ${id}`);

      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Delete row error:', error);
      res.status(500).json({ error: 'Failed to delete row' });
    }
  });

  app.get('/api/admin/database/export/:tableName', rateLimit(60, 5), isAdmin, async (req, res) => {
    try {
      const { tableName } = req.params;

      const result = await db.execute(sql.raw(`SELECT * FROM ${tableName}`));
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'No data to export' });
      }

      // Convert to CSV
      const headers = Object.keys(result.rows[0]);
      const csvContent = [
        headers.join(','),
        ...result.rows.map(row => 
          headers.map(header => {
            const value = row[header];
            if (value === null || value === undefined) return '';
            if (typeof value === 'string' && value.includes(',')) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return String(value);
          }).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${tableName}_export.csv"`);
      res.send(csvContent);
    } catch (error) {
      console.error('[ADMIN] Export error:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  });

  // Delete connection
  app.delete('/api/admin/connections/:connectionId', rateLimit(60, 20), isAdmin, async (req, res) => {
    try {
      const { connectionId } = req.params;
      
      await db.delete(connections).where(eq(connections.id, parseInt(connectionId)));
      
      res.json({ success: true });
    } catch (error) {
      console.error('[ADMIN] Delete connection error:', error);
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  });

  // Subscription management endpoints
  app.get('/api/admin/subscriptions', rateLimit(60, 50), isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const tier = req.query.tier as string;
      const status = req.query.status as string;
      const offset = (page - 1) * limit;

      let query = db.select().from(users);
      const conditions = [];

      if (tier) conditions.push(eq(users.subscriptionTier, tier));
      if (status) conditions.push(eq(users.subscriptionStatus, status));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const subscriptionList = await query
        .orderBy(desc(users.createdAt))
        .limit(limit)
        .offset(offset);

      const totalCount = await db.select({ count: count() }).from(users);

      // Calculate revenue metrics
      const revenueMetrics = await db.execute(sql`
        SELECT 
          subscription_tier,
          subscription_status,
          COUNT(*) as user_count,
          CASE 
            WHEN subscription_tier = 'basic' THEN COUNT(*) * 9.95
            WHEN subscription_tier = 'advanced' THEN COUNT(*) * 19.95
            WHEN subscription_tier = 'unlimited' THEN COUNT(*) * 39.95
            ELSE 0
          END as monthly_revenue
        FROM users
        WHERE subscription_tier != 'trial'
        GROUP BY subscription_tier, subscription_status
      `);

      res.json({
        subscriptions: subscriptionList,
        metrics: revenueMetrics.rows,
        pagination: {
          page,
          limit,
          total: totalCount[0].count,
          totalPages: Math.ceil(totalCount[0].count / limit)
        }
      });
    } catch (error) {
      console.error('[ADMIN] Subscriptions list error:', error);
      res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
  });

  // Bulk subscription updates
  app.patch('/api/admin/subscriptions/bulk', rateLimit(60, 10), isAdmin, async (req, res) => {
    try {
      const { userIds, subscriptionTier, subscriptionStatus } = req.body;
      
      if (!userIds || !Array.isArray(userIds)) {
        return res.status(400).json({ error: 'User IDs array required' });
      }

      const tierLimits = {
        trial: 1,
        basic: 1,
        advanced: 3,
        unlimited: 999
      };

      const updateData: any = {};
      if (subscriptionTier) {
        updateData.subscriptionTier = subscriptionTier;
        updateData.maxConnections = tierLimits[subscriptionTier as keyof typeof tierLimits] || 1;
      }
      if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
      updateData.updatedAt = new Date();

      for (const userId of userIds) {
        await storage.updateUser(userId, updateData);
      }

      res.json({ success: true, updated: userIds.length });
    } catch (error) {
      console.error('[ADMIN] Bulk subscription update error:', error);
      res.status(500).json({ error: 'Failed to update subscriptions' });
    }
  });

  // Advanced user search with filters
  app.get('/api/admin/users/search', rateLimit(60, 100), isAdmin, async (req, res) => {
    try {
      const { query: searchQuery, tier, status, dateFrom, dateTo } = req.query;
      
      let query = db.select().from(users);
      const conditions = [];

      if (searchQuery) {
        conditions.push(
          or(
            sql`${users.email} ILIKE ${`%${searchQuery}%`}`,
            sql`${users.firstName} ILIKE ${`%${searchQuery}%`}`,
            sql`${users.lastName} ILIKE ${`%${searchQuery}%`}`
          )
        );
      }

      if (tier) conditions.push(eq(users.subscriptionTier, tier as string));
      if (status) conditions.push(eq(users.subscriptionStatus, status as string));
      if (dateFrom) conditions.push(gte(users.createdAt, new Date(dateFrom as string)));
      if (dateTo) conditions.push(lte(users.createdAt, new Date(dateTo as string)));

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const results = await query
        .orderBy(desc(users.createdAt))
        .limit(100);

      res.json({ users: results });
    } catch (error) {
      console.error('[ADMIN] User search error:', error);
      res.status(500).json({ error: 'Failed to search users' });
    }
  });

  console.log('[ADMIN] Admin routes configured successfully');
}