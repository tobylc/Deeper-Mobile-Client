import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Users, 
  MessageSquare, 
  Activity, 
  TrendingUp, 
  Database, 
  Mail,
  Phone,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  LineChart,
  PieChart,
  Settings,
  Search,
  Eye,
  Edit,
  RefreshCw,
  Download,
  Shield,
  Trash2,
  UserCheck
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell } from "recharts";
import AdminAccessGuard from "@/components/admin-access-guard";
import RetentionChart from "@/components/retention-chart";
import AdminDatabaseBrowser from "@/components/admin-database-browser";
import AdvancedAnalytics from "@/components/advanced-analytics";
import { AdminEmailCampaigns } from "@/components/admin-email-campaigns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Admin Dashboard Types
interface AdminStats {
  users: {
    total: number;
    active: number;
    newToday: number;
    newThisWeek: number;
    subscriptionBreakdown: Array<{ tier: string; count: number }>;
    engagement: Array<{ subscription_tier: string; user_count: number; avg_messages_per_user: number; avg_conversations_per_user: number }>;
  };
  connections: {
    total: number;
    accepted: number;
    pending: number;
    acceptanceRate: string;
  };
  conversations: {
    total: number;
    active: number;
  };
  messages: {
    total: number;
    thisWeek: number;
    today: number;
    typeBreakdown: Array<{ format: string; count: number }>;
  };
  emails: {
    typeBreakdown: Array<{ type: string; count: number }>;
  };
}

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  maxConnections: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminUsersResponse {
  users: AdminUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AdminUserDetails {
  user: AdminUser;
  connections: Array<{
    id: string;
    inviterEmail: string;
    inviteeEmail: string;
    relationshipType: string;
    status: string;
  }>;
  conversations: Array<{
    id: string;
    title?: string;
    status: string;
    lastActivityAt: string;
  }>;
  messages: Array<{
    id: string;
    content: string;
    type: string;
    createdAt: string;
  }>;
}

interface SystemHealth {
  database: {
    healthy: boolean;
    tables: Array<{
      tablename: string;
      live_rows: number;
      inserts: number;
      updates: number;
      deletes: number;
    }>;
  };
  errors: {
    recentEmailFailures: number;
  };
  timestamp: string;
}

interface DebugIssues {
  failedEmails: Array<{ id: string; toEmail: string; subject: string; sentAt: string }>;
  expiredTrials: Array<{ id: string; email: string; trialExpiresAt: string }>;
  staleConnections: Array<{ id: string; inviteeEmail: string; createdAt: string }>;
}

interface AdminConnection {
  id: number;
  inviterEmail: string;
  inviteeEmail: string;
  inviterRole: string;
  inviteeRole: string;
  relationshipType: string;
  status: string;
  createdAt: string;
}

interface AdminConnectionsResponse {
  connections: AdminConnection[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AdminMessage {
  id: number;
  content: string;
  type: string;
  messageformat?: string;
  message_format?: string;
  senderemail?: string;
  sender_email?: string;
  participant1_email?: string;
  participant2_email?: string;
  created_at?: string;
  createdAt?: string;
  transcription?: string;
}

interface AdminMessagesResponse {
  messages: AdminMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface AdminSubscription {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  maxConnections: number;
  stripeCustomerId: string;
  createdAt: string;
}

interface SubscriptionMetric {
  subscription_tier: string;
  subscription_status: string;
  user_count: number;
  monthly_revenue: number;
}

interface AdminSubscriptionsResponse {
  subscriptions: AdminSubscription[];
  metrics: SubscriptionMetric[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface ActivityChartData {
  date: string;
  new_users: number;
  messages: number;
  connections: number;
}

// Color palette for charts
const COLORS = ['#4FACFE', '#D7A087', '#22D3EE', '#F59E0B', '#EF4444', '#10B981'];

function AdminStats() {
  const { data: stats, isLoading } = useQuery<AdminStats>({
    queryKey: ['/api/admin/stats'],
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-slate-200 rounded mb-4"></div>
              <div className="h-8 bg-slate-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.users.newThisWeek} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.connections.accepted.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.connections.acceptanceRate}% acceptance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messages.today.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {stats.messages.thisWeek.toLocaleString()} this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Metrics</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.users.subscriptionBreakdown.filter(s => s.tier !== 'trial').reduce((sum, s) => sum + s.count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">Paying users</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Subscription Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.users.subscriptionBreakdown.map((tier, index) => (
                <div key={tier.tier} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="capitalize">{tier.tier}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{tier.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {((tier.count / stats.users.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Message Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.messages.typeBreakdown.map((type, index) => (
                <div key={type.format} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <span className="capitalize">{type.format}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{type.count}</div>
                    <div className="text-xs text-muted-foreground">
                      {((type.count / stats.messages.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActivityChart() {
  const [days, setDays] = useState(30);
  const { data: chartData, isLoading } = useQuery<ActivityChartData[]>({
    queryKey: ['/api/admin/activity-chart', { days }],
    refetchInterval: 60000 // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Activity Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80 flex items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Activity Trends</CardTitle>
        <Select value={days.toString()} onValueChange={(value) => setDays(parseInt(value))}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 days</SelectItem>
            <SelectItem value="30">30 days</SelectItem>
            <SelectItem value="90">90 days</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <RechartsLineChart data={chartData || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => format(new Date(value), 'MMM dd')}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip 
              labelFormatter={(value) => format(new Date(value), 'MMM dd, yyyy')}
            />
            <Line 
              type="monotone" 
              dataKey="new_users" 
              stroke="#4FACFE" 
              strokeWidth={2}
              name="New Users"
            />
            <Line 
              type="monotone" 
              dataKey="messages" 
              stroke="#D7A087" 
              strokeWidth={2}
              name="Messages"
            />
            <Line 
              type="monotone" 
              dataKey="connections" 
              stroke="#22D3EE" 
              strokeWidth={2}
              name="Connections"
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function UserManagement() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const { toast } = useToast();

  const { data: usersData, isLoading } = useQuery<AdminUsersResponse>({
    queryKey: ['/api/admin/users', { page, search }],
    refetchInterval: 30000
  });

  const { data: userDetails } = useQuery<AdminUserDetails>({
    queryKey: ['/api/admin/users', selectedUser?.id],
    enabled: !!selectedUser?.id
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (data: { userId: string; subscriptionTier: string; subscriptionStatus: string }) => {
      const response = await fetch(`/api/admin/users/${data.userId}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update subscription');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User subscription updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user subscription", variant: "destructive" });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Subscription</th>
                  <th className="p-4 font-medium">Connections</th>
                  <th className="p-4 font-medium">Joined</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {usersData?.users.map((user: any) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.profileImageUrl} />
                          <AvatarFallback>
                            {user.firstName?.[0]}{user.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.subscriptionTier === 'trial' ? 'secondary' : 'default'}>
                        {user.subscriptionTier}
                      </Badge>
                    </td>
                    <td className="p-4">{user.maxConnections}</td>
                    <td className="p-4">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>
                    <td className="p-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>User Details</DialogTitle>
                          </DialogHeader>
                          {userDetails && (
                            <UserDetailsModal user={userDetails.user} data={userDetails} />
                          )}
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {usersData && (
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, usersData.pagination.total)} of {usersData.pagination.total} users
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= usersData.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserDetailsModal({ user, data }: { user: AdminUser; data: AdminUserDetails }) {
  const [subscriptionTier, setSubscriptionTier] = useState(user.subscriptionTier);
  const [subscriptionStatus, setSubscriptionStatus] = useState(user.subscriptionStatus);
  const { toast } = useToast();

  const updateSubscriptionMutation = useMutation({
    mutationFn: async (updateData: { subscriptionTier: string; subscriptionStatus: string }) => {
      const response = await fetch(`/api/admin/users/${user.id}/subscription`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData)
      });
      if (!response.ok) throw new Error('Failed to update subscription');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "User subscription updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update user subscription", variant: "destructive" });
    }
  });

  const handleUpdateSubscription = () => {
    updateSubscriptionMutation.mutate({ subscriptionTier, subscriptionStatus });
  };

  return (
    <div className="space-y-6">
      {/* User Info */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Name</Label>
          <div className="font-medium">{user.firstName} {user.lastName}</div>
        </div>
        <div>
          <Label>Email</Label>
          <div className="font-medium">{user.email}</div>
        </div>
        <div>
          <Label>Subscription Tier</Label>
          <Select value={subscriptionTier} onValueChange={setSubscriptionTier}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="unlimited">Unlimited</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={subscriptionStatus} onValueChange={setSubscriptionStatus}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-2">
        <Button 
          onClick={handleUpdateSubscription} 
          disabled={updateSubscriptionMutation.isPending}
          className="bg-ocean hover:bg-blue-600"
        >
          {updateSubscriptionMutation.isPending ? 'Updating...' : 'Update Subscription'}
        </Button>
      </div>

      <Separator />

      {/* Connections */}
      <div>
        <h3 className="font-medium mb-3">Connections ({data.connections.length})</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {data.connections.map((conn) => (
            <div key={conn.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <div className="text-sm font-medium">
                  {conn.inviterEmail === user.email ? conn.inviteeEmail : conn.inviterEmail}
                </div>
                <div className="text-xs text-muted-foreground">
                  {conn.relationshipType} • {conn.status}
                </div>
              </div>
              <Badge variant={conn.status === 'accepted' ? 'default' : 'secondary'}>
                {conn.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Recent Messages */}
      <div>
        <h3 className="font-medium mb-3">Recent Messages ({data.messages.length})</h3>
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {data.messages.slice(0, 10).map((msg) => (
            <div key={msg.id} className="p-2 border rounded">
              <div className="text-sm">{msg.content.substring(0, 100)}...</div>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(msg.createdAt), 'MMM dd, yyyy h:mm a')} • {msg.type}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SystemHealth() {
  const { data: health, isLoading } = useQuery<SystemHealth>({
    queryKey: ['/api/admin/system-health'],
    refetchInterval: 30000
  });

  const { data: issues } = useQuery<DebugIssues>({
    queryKey: ['/api/admin/debug/recent-issues'],
    refetchInterval: 60000
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-4 bg-slate-200 rounded mb-4"></div>
            <div className="h-8 bg-slate-200 rounded"></div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {health?.database.healthy ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              <span className={health?.database.healthy ? 'text-green-600' : 'text-red-600'}>
                {health?.database.healthy ? 'Healthy' : 'Issues Detected'}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email System</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              {(health?.errors.recentEmailFailures || 0) < 5 ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              <span>
                {health?.errors.recentEmailFailures || 0} failures today
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {health?.timestamp ? formatDistanceToNow(new Date(health.timestamp), { addSuffix: true }) : 'Unknown'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Tables */}
      {health?.database.tables && (
        <Card>
          <CardHeader>
            <CardTitle>Database Tables</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Table</th>
                    <th className="text-left p-2">Live Rows</th>
                    <th className="text-left p-2">Inserts</th>
                    <th className="text-left p-2">Updates</th>
                    <th className="text-left p-2">Deletes</th>
                  </tr>
                </thead>
                <tbody>
                  {health.database.tables.map((table: any) => (
                    <tr key={table.tablename} className="border-b">
                      <td className="p-2 font-medium">{table.tablename}</td>
                      <td className="p-2">{table.live_rows?.toLocaleString()}</td>
                      <td className="p-2">{table.inserts?.toLocaleString()}</td>
                      <td className="p-2">{table.updates?.toLocaleString()}</td>
                      <td className="p-2">{table.deletes?.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Issues */}
      {issues && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Failed Emails</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {issues.failedEmails?.slice(0, 5).map((email: any) => (
                  <div key={email.id} className="text-xs">
                    <div className="font-medium">{email.toEmail}</div>
                    <div className="text-muted-foreground">{email.subject}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Expired Trials</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {issues.expiredTrials?.slice(0, 5).map((user: any) => (
                  <div key={user.id} className="text-xs">
                    <div className="font-medium">{user.email}</div>
                    <div className="text-muted-foreground">
                      Expired {formatDistanceToNow(new Date(user.trialExpiresAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Stale Connections</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {issues.staleConnections?.slice(0, 5).map((conn: any) => (
                  <div key={conn.id} className="text-xs">
                    <div className="font-medium">{conn.inviteeEmail}</div>
                    <div className="text-muted-foreground">
                      Pending {formatDistanceToNow(new Date(conn.createdAt), { addSuffix: true })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function ConnectionManagement() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const { data: connectionsData, isLoading } = useQuery<AdminConnectionsResponse>({
    queryKey: ['/api/admin/connections', { page, status: statusFilter === 'all' ? '' : statusFilter }],
    refetchInterval: 30000
  });

  const deleteConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const response = await fetch(`/api/admin/connections/${connectionId}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Failed to delete connection');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Connection deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/connections'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete connection", variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Connection Management</h2>
          <p className="text-slate-300">Monitor and manage user connections</p>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium">Inviter</th>
                  <th className="p-4 font-medium">Invitee</th>
                  <th className="p-4 font-medium">Relationship</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {connectionsData?.connections?.map((connection) => (
                  <tr key={connection.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{connection.inviterEmail}</div>
                        <div className="text-sm text-muted-foreground">{connection.inviterRole}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{connection.inviteeEmail}</div>
                        <div className="text-sm text-muted-foreground">{connection.inviteeRole}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{connection.relationshipType}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={
                        connection.status === 'accepted' ? 'default' : 
                        connection.status === 'pending' ? 'secondary' : 'destructive'
                      }>
                        {connection.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {formatDistanceToNow(new Date(connection.createdAt), { addSuffix: true })}
                    </td>
                    <td className="p-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteConnectionMutation.mutate(connection.id)}
                        disabled={deleteConnectionMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {connectionsData && (
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, connectionsData.pagination.total)} of {connectionsData.pagination.total} connections
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= connectionsData.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MessageManagement() {
  const [page, setPage] = useState(1);
  const [formatFilter, setFormatFilter] = useState('all');
  const [selectedMessage, setSelectedMessage] = useState<any>(null);

  const { data: messagesData, isLoading } = useQuery<AdminMessagesResponse>({
    queryKey: ['/api/admin/messages', { page, format: formatFilter === 'all' ? '' : formatFilter }],
    refetchInterval: 30000
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Message Management</h2>
          <p className="text-slate-300">Monitor conversations and messages</p>
        </div>
        <div className="flex gap-2">
          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Formats</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4 font-medium">Sender</th>
                  <th className="p-4 font-medium">Content Preview</th>
                  <th className="p-4 font-medium">Type</th>
                  <th className="p-4 font-medium">Format</th>
                  <th className="p-4 font-medium">Conversation</th>
                  <th className="p-4 font-medium">Created</th>
                  <th className="p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messagesData?.messages?.map((message) => (
                  <tr key={message.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <div className="font-medium">{message.senderemail || message.sender_email}</div>
                    </td>
                    <td className="p-4">
                      <div className="max-w-xs truncate">
                        {message.content.substring(0, 100)}...
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant="outline">{message.type}</Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={message.messageformat === 'voice' || message.message_format === 'voice' ? 'default' : 'secondary'}>
                        {message.messageformat || message.message_format}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">
                        <div>{message.participant1_email}</div>
                        <div className="text-muted-foreground">↔ {message.participant2_email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      {formatDistanceToNow(new Date(message.created_at || message.createdAt), { addSuffix: true })}
                    </td>
                    <td className="p-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setSelectedMessage(message)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Message Details</DialogTitle>
                          </DialogHeader>
                          {selectedMessage && (
                            <div className="space-y-4">
                              <div>
                                <Label>Content</Label>
                                <div className="p-3 border rounded bg-muted/50">
                                  {selectedMessage.content}
                                </div>
                              </div>
                              {selectedMessage.transcription && (
                                <div>
                                  <Label>Transcription</Label>
                                  <div className="p-3 border rounded bg-muted/50">
                                    {selectedMessage.transcription}
                                  </div>
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label>Type</Label>
                                  <div>{selectedMessage.type}</div>
                                </div>
                                <div>
                                  <Label>Format</Label>
                                  <div>{selectedMessage.messageformat || selectedMessage.message_format}</div>
                                </div>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {messagesData && (
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, messagesData.pagination.total)} of {messagesData.pagination.total} messages
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= messagesData.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  return (
    <AdminAccessGuard>
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Admin Portal</h1>
          <p className="text-slate-300">Monitor and manage your Deeper platform</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 bg-slate-800 border-slate-700">
            <TabsTrigger value="overview" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <BarChart3 className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="connections" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <Activity className="h-4 w-4 mr-2" />
              Connections
            </TabsTrigger>
            <TabsTrigger value="messages" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <MessageSquare className="h-4 w-4 mr-2" />
              Messages
            </TabsTrigger>
            <TabsTrigger value="emails" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <Mail className="h-4 w-4 mr-2" />
              Email Campaigns
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <LineChart className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="database" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <Database className="h-4 w-4 mr-2" />
              Database
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-ocean data-[state=active]:text-white">
              <Settings className="h-4 w-4 mr-2" />
              System
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <AdminStats />
            <ActivityChart />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>

          <TabsContent value="connections" className="space-y-6">
            <ConnectionManagement />
          </TabsContent>

          <TabsContent value="messages" className="space-y-6">
            <MessageManagement />
          </TabsContent>

          <TabsContent value="emails" className="space-y-6">
            <AdminEmailCampaigns />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <AdvancedAnalytics />
            <ActivityChart />
            <RetentionChart />
          </TabsContent>

          <TabsContent value="database" className="space-y-6">
            <AdminDatabaseBrowser />
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <SystemHealth />
            <SubscriptionManagement />
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </AdminAccessGuard>
  );
}

function SubscriptionManagement() {
  const [page, setPage] = useState(1);
  const [tierFilter, setTierFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const { toast } = useToast();

  const { data: subscriptionsData, isLoading } = useQuery<AdminSubscriptionsResponse>({
    queryKey: ['/api/admin/subscriptions', { 
      page, 
      tier: tierFilter === 'all' ? '' : tierFilter, 
      status: statusFilter === 'all' ? '' : statusFilter 
    }],
    refetchInterval: 30000
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: { userIds: string[]; subscriptionTier?: string; subscriptionStatus?: string }) => {
      const response = await fetch('/api/admin/subscriptions/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update subscriptions');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: "Success", description: `Updated ${data.updated} subscriptions` });
      setSelectedUsers([]);
      queryClient.invalidateQueries({ queryKey: ['/api/admin/subscriptions'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update subscriptions", variant: "destructive" });
    }
  });

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllUsers = () => {
    if (!subscriptionsData?.subscriptions) return;
    setSelectedUsers(subscriptionsData.subscriptions.map((user: any) => user.id));
  };

  const clearSelection = () => setSelectedUsers([]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white">Subscription Management</h2>
          <p className="text-slate-300">Manage user subscriptions and billing</p>
        </div>
        <div className="flex gap-2">
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
              <SelectItem value="unlimited">Unlimited</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
              <SelectItem value="trial_expired">Trial Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Revenue Metrics */}
      {subscriptionsData?.metrics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {subscriptionsData.metrics.map((metric, index: number) => (
            <Card key={index}>
              <CardContent className="p-4">
                <div className="text-sm font-medium capitalize">{metric.subscription_tier} ({metric.subscription_status})</div>
                <div className="text-2xl font-bold">{metric.user_count}</div>
                <div className="text-xs text-muted-foreground">
                  ${Number(metric.monthly_revenue || 0).toFixed(2)}/mo
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedUsers.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {selectedUsers.length} users selected
              </div>
              <div className="flex gap-2">
                <Select onValueChange={(tier) => bulkUpdateMutation.mutate({ userIds: selectedUsers, subscriptionTier: tier })}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Bulk update tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trial">Trial</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="unlimited">Unlimited</SelectItem>
                  </SelectContent>
                </Select>
                <Select onValueChange={(status) => bulkUpdateMutation.mutate({ userIds: selectedUsers, subscriptionStatus: status })}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Bulk update status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={clearSelection}>Clear</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr className="text-left">
                  <th className="p-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === subscriptionsData?.subscriptions?.length}
                      onChange={() => selectedUsers.length === subscriptionsData?.subscriptions?.length ? clearSelection() : selectAllUsers()}
                    />
                  </th>
                  <th className="p-4 font-medium">User</th>
                  <th className="p-4 font-medium">Tier</th>
                  <th className="p-4 font-medium">Status</th>
                  <th className="p-4 font-medium">Connections</th>
                  <th className="p-4 font-medium">Stripe ID</th>
                  <th className="p-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {subscriptionsData?.subscriptions?.map((user) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="p-4">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                      />
                    </td>
                    <td className="p-4">
                      <div>
                        <div className="font-medium">{user.firstName} {user.lastName}</div>
                        <div className="text-sm text-muted-foreground">{user.email}</div>
                      </div>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.subscriptionTier === 'trial' ? 'secondary' : 'default'}>
                        {user.subscriptionTier}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge variant={user.subscriptionStatus === 'active' ? 'default' : 'destructive'}>
                        {user.subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="p-4">{user.maxConnections}</td>
                    <td className="p-4">
                      <div className="text-xs font-mono">
                        {user.stripeCustomerId?.substring(0, 20)}...
                      </div>
                    </td>
                    <td className="p-4">
                      {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {subscriptionsData && (
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {(page - 1) * 20 + 1} to {Math.min(page * 20, subscriptionsData.pagination.total)} of {subscriptionsData.pagination.total} users
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= subscriptionsData.pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}