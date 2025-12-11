import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, TrendingDown, Users, MessageCircle, Clock, DollarSign } from "lucide-react";

const COLORS = ['#4FACFE', '#D7A087', '#22D3EE', '#F59E0B', '#EF4444', '#10B981'];

export default function AdvancedAnalytics() {
  const { data: stats } = useQuery({
    queryKey: ['/api/admin/stats'],
    refetchInterval: 60000
  });

  if (!stats) return null;

  const engagementData = stats.users.engagement.map((item: any, index: number) => ({
    tier: item.subscription_tier,
    users: parseInt(item.user_count),
    avgMessages: parseFloat(item.avg_messages_per_user) || 0,
    avgConversations: parseFloat(item.avg_conversations_per_user) || 0,
    color: COLORS[index % COLORS.length]
  }));

  const subscriptionPieData = stats.users.subscriptionBreakdown.map((item: any, index: number) => ({
    name: item.tier,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const messageTypeData = stats.messages.typeBreakdown.map((item: any, index: number) => ({
    name: item.format,
    value: item.count,
    color: COLORS[index % COLORS.length]
  }));

  const conversionRate = stats.users.subscriptionBreakdown.reduce((paid, item) => 
    item.tier !== 'trial' ? paid + item.count : paid, 0
  ) / stats.users.total * 100;

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trial Conversion</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{conversionRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.users.subscriptionBreakdown.find(s => s.tier !== 'trial')?.count || 0} paying users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Messages/User</CardTitle>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats.messages.total / stats.users.total).toFixed(1)}
            </div>
            <p className="text-xs text-muted-foreground">
              Per registered user
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connection Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.connections.acceptanceRate}%</div>
            <p className="text-xs text-muted-foreground">
              Invitation acceptance rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Daily Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${((stats.users.subscriptionBreakdown.reduce((sum, tier) => {
                const dailyRevenue = tier.tier === 'basic' ? 4.95 : 
                                  tier.tier === 'advanced' ? 9.95 : 
                                  tier.tier === 'unlimited' ? 19.95 : 0;
                return sum + (tier.count * dailyRevenue / 30);
              }, 0))).toFixed(0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated daily MRR
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={subscriptionPieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {subscriptionPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Message Format Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Message Types</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={messageTypeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4FACFE" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* User Engagement by Tier */}
      <Card>
        <CardHeader>
          <CardTitle>User Engagement by Subscription Tier</CardTitle>
          <p className="text-sm text-muted-foreground">
            Average activity levels across different subscription tiers
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={engagementData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="tier" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" />
              <Tooltip />
              <Legend />
              <Bar 
                yAxisId="left" 
                dataKey="avgMessages" 
                fill="#4FACFE" 
                name="Avg Messages per User"
              />
              <Bar 
                yAxisId="right" 
                dataKey="avgConversations" 
                fill="#D7A087" 
                name="Avg Conversations per User"
              />
            </BarChart>
          </ResponsiveContainer>
          
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            {engagementData.map((tier, index) => (
              <div key={tier.tier} className="text-center p-4 border rounded-lg">
                <Badge variant="outline" className="mb-2">{tier.tier}</Badge>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Users: {tier.users}</div>
                  <div className="text-sm text-muted-foreground">
                    Msgs: {tier.avgMessages.toFixed(1)} | Convos: {tier.avgConversations.toFixed(1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Email Analytics */}
      {stats.emails?.typeBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>Email Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {stats.emails.typeBreakdown.map((email: any, index: number) => (
                <div key={email.type} className="text-center p-4 border rounded-lg">
                  <div 
                    className="w-4 h-4 rounded-full mx-auto mb-2"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <div className="font-medium capitalize">{email.type}</div>
                  <div className="text-2xl font-bold">{email.count}</div>
                  <div className="text-xs text-muted-foreground">emails sent</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}