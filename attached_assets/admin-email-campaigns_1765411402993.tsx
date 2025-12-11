import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Mail, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Calendar, 
  Users, 
  BarChart3,
  Eye,
  Play,
  Pause,
  Settings,
  Plus,
  Filter,
  Search,
  Download,
  RefreshCw
} from 'lucide-react';

// Email Campaign Types
interface EmailCampaign {
  id: number;
  userEmail: string;
  campaignType: string;
  triggerEvent: string;
  userType: string;
  scheduledAt: string;
  delayHours: number;
  emailSubject: string;
  emailContent: string;
  status: string;
  sentAt?: string;
  createdAt: string;
}

interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
  byType: Record<string, number>;
}

interface TemplatePreview {
  campaignType: string;
  subject: string;
  textContent: string;
  htmlContent: string;
  previewNote: string;
}

const campaignTypeLabels = {
  'post_signup': 'Post-Signup Nudge',
  'inviter_nudge': 'Inviter Nudge (72h)',
  'pending_invitation': 'Pending Invitation Reminder',
  'turn_reminder': 'Turn Reminder'
};

const statusColors = {
  'scheduled': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'sent': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'failed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  'cancelled': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
};

export function AdminEmailCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State for filters and pagination
  const [filters, setFilters] = useState({
    status: 'all',
    campaignType: 'all',
    userEmail: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 25
  });

  // State for manual campaign creation
  const [manualCampaign, setManualCampaign] = useState({
    userEmail: '',
    campaignType: '',
    scheduledAt: '',
    delayHours: 0
  });

  // State for template preview
  const [selectedPreviewType, setSelectedPreviewType] = useState('post_signup');

  // Fetch campaign data with filters
  const { data: campaignData, isLoading: campaignsLoading, refetch: refetchCampaigns } = useQuery({
    queryKey: ['/api/admin/email-campaigns', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
      const response = await apiRequest('GET', `/api/admin/email-campaigns?${params}`);
      return response.json();
    }
  });

  // Fetch campaign statistics
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/admin/email-campaigns/stats'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/email-campaigns/stats');
      return response.json();
    }
  });

  // Fetch template preview
  const { data: templatePreview, isLoading: templateLoading } = useQuery({
    queryKey: ['/api/admin/email-campaigns/template-preview', selectedPreviewType],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/admin/email-campaigns/template-preview/${selectedPreviewType}`);
      return response.json();
    }
  });

  // Fetch processor status
  const { data: processorStatus } = useQuery({
    queryKey: ['/api/admin/email-campaigns/processor-status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/admin/email-campaigns/processor-status');
      return response.json();
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Create manual campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (campaignData: any) => {
      const response = await apiRequest('POST', '/api/admin/email-campaigns/manual', campaignData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Campaign Created",
        description: "Manual email campaign has been scheduled successfully."
      });
      setManualCampaign({ userEmail: '', campaignType: '', scheduledAt: '', delayHours: 0 });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns/stats'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive"
      });
    }
  });

  // Update campaign status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, scheduledAt }: { id: number; status: string; scheduledAt?: string }) => {
      const response = await apiRequest('PATCH', `/api/admin/email-campaigns/${id}/status`, { status, scheduledAt });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Status Updated",
        description: "Campaign status has been updated successfully."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns'] });
    }
  });

  // Send test email mutation
  const testEmailMutation = useMutation({
    mutationFn: async ({ campaignType, testEmail }: { campaignType: string; testEmail: string }) => {
      const response = await apiRequest('POST', '/api/admin/email-campaigns/test', { campaignType, testEmail });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Test Email Sent",
        description: "Test email has been sent successfully."
      });
    }
  });

  // Process campaigns manually mutation
  const processNowMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/admin/email-campaigns/process-now');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Processing Complete",
        description: "Email campaigns have been processed manually."
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/email-campaigns'] });
    }
  });

  // Handle filter changes
  const updateFilter = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  // Handle pagination
  const changePage = (newPage: number) => {
    setFilters(prev => ({ ...prev, page: newPage }));
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Create manual campaign
  const handleCreateCampaign = () => {
    if (!manualCampaign.userEmail || !manualCampaign.campaignType) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    const scheduledAt = manualCampaign.scheduledAt 
      ? new Date(manualCampaign.scheduledAt).toISOString()
      : new Date(Date.now() + manualCampaign.delayHours * 60 * 60 * 1000).toISOString();

    createCampaignMutation.mutate({
      userEmail: manualCampaign.userEmail,
      campaignType: manualCampaign.campaignType,
      triggerEvent: 'admin_manual',
      userType: 'manual',
      scheduledAt,
      delayHours: manualCampaign.delayHours,
      emailSubject: `Manual ${campaignTypeLabels[manualCampaign.campaignType as keyof typeof campaignTypeLabels]}`,
      emailContent: `This is a manually scheduled ${manualCampaign.campaignType} campaign.`
    });
  };

  const campaigns = campaignData?.campaigns || [];
  const pagination = campaignData?.pagination || { page: 1, pages: 1, total: 0 };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Campaign Management</h2>
          <p className="text-muted-foreground">
            Manage automated email campaigns with complete oversight and control
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => processNowMutation.mutate()}
            disabled={processNowMutation.isPending}
            size="sm"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Process Now
          </Button>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Create Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Manual Email Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="userEmail">User Email</Label>
                    <Input
                      id="userEmail"
                      value={manualCampaign.userEmail}
                      onChange={(e) => setManualCampaign(prev => ({ ...prev, userEmail: e.target.value }))}
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="campaignType">Campaign Type</Label>
                    <Select
                      value={manualCampaign.campaignType}
                      onValueChange={(value) => setManualCampaign(prev => ({ ...prev, campaignType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(campaignTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="scheduledAt">Scheduled Time (Optional)</Label>
                    <Input
                      id="scheduledAt"
                      type="datetime-local"
                      value={manualCampaign.scheduledAt}
                      onChange={(e) => setManualCampaign(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="delayHours">Delay (Hours)</Label>
                    <Input
                      id="delayHours"
                      type="number"
                      value={manualCampaign.delayHours}
                      onChange={(e) => setManualCampaign(prev => ({ ...prev, delayHours: parseInt(e.target.value) || 0 }))}
                      placeholder="0"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={handleCreateCampaign}
                    disabled={createCampaignMutation.isPending}
                  >
                    Create Campaign
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-xs text-muted-foreground">Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.failed}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Pause className="h-4 w-4 text-gray-600" />
                <div>
                  <p className="text-2xl font-bold">{stats.cancelled}</p>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Settings className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold">{processorStatus?.status === 'running' ? 'Running' : 'Stopped'}</p>
                  <p className="text-xs text-muted-foreground">Processor</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campaign List</TabsTrigger>
          <TabsTrigger value="templates">Template Preview</TabsTrigger>
          <TabsTrigger value="testing">Test Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select value={filters.status} onValueChange={(value) => updateFilter('status', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Campaign Type</Label>
                  <Select value={filters.campaignType} onValueChange={(value) => updateFilter('campaignType', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {Object.entries(campaignTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>User Email</Label>
                  <Input
                    value={filters.userEmail}
                    onChange={(e) => updateFilter('userEmail', e.target.value)}
                    placeholder="Search by email"
                  />
                </div>
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => updateFilter('startDate', e.target.value)}
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => updateFilter('endDate', e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Campaign List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Email Campaigns ({pagination.total})</span>
                <Button onClick={() => refetchCampaigns()} size="sm" variant="outline">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {campaignsLoading ? (
                <div className="text-center py-8">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No campaigns found matching your filters.
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign: EmailCampaign) => (
                    <div key={campaign.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge className={statusColors[campaign.status as keyof typeof statusColors]}>
                            {campaign.status}
                          </Badge>
                          <span className="font-medium">
                            {campaignTypeLabels[campaign.campaignType as keyof typeof campaignTypeLabels]}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            to {campaign.userEmail}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          {campaign.status === 'scheduled' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: campaign.id, status: 'cancelled' })}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const newTime = prompt('New scheduled time (YYYY-MM-DD HH:mm):');
                                  if (newTime) {
                                    updateStatusMutation.mutate({ 
                                      id: campaign.id, 
                                      status: 'scheduled', 
                                      scheduledAt: new Date(newTime).toISOString() 
                                    });
                                  }
                                }}
                              >
                                Reschedule
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <strong>Scheduled:</strong> {formatDate(campaign.scheduledAt)}
                        </div>
                        <div>
                          <strong>Created:</strong> {formatDate(campaign.createdAt)}
                        </div>
                        {campaign.sentAt && (
                          <div>
                            <strong>Sent:</strong> {formatDate(campaign.sentAt)}
                          </div>
                        )}
                      </div>
                      <div className="text-sm">
                        <strong>Subject:</strong> {campaign.emailSubject}
                      </div>
                      <details className="text-sm">
                        <summary className="cursor-pointer font-medium">Email Content</summary>
                        <div className="mt-2 p-3 bg-muted rounded whitespace-pre-wrap">
                          {campaign.emailContent}
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}

              {/* Pagination */}
              {pagination.pages > 1 && (
                <div className="flex items-center justify-between mt-6">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changePage(pagination.page - 1)}
                      disabled={pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => changePage(pagination.page + 1)}
                      disabled={pagination.page >= pagination.pages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Email Template Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label>Campaign Type</Label>
                  <Select value={selectedPreviewType} onValueChange={setSelectedPreviewType}>
                    <SelectTrigger className="w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(campaignTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {templatePreview && (
                  <div className="space-y-4">
                    <div className="p-4 border rounded-lg bg-blue-50 dark:bg-blue-950">
                      <p className="text-sm text-blue-600 dark:text-blue-400">
                        {templatePreview.previewNote}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Subject Line</h4>
                      <div className="p-3 border rounded bg-muted">
                        {templatePreview.subject}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Text Content</h4>
                      <div className="p-3 border rounded bg-muted whitespace-pre-wrap text-sm">
                        {templatePreview.textContent}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">HTML Preview</h4>
                      <div className="p-3 border rounded bg-white">
                        <iframe
                          srcDoc={templatePreview.htmlContent}
                          className="w-full h-96 border-0"
                          title="Email HTML Preview"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-5 w-5" />
                Test Email Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Campaign Type</Label>
                    <Select onValueChange={(value) => setSelectedPreviewType(value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(campaignTypeLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Test Email Address</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="test@example.com"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            const email = (e.target as HTMLInputElement).value;
                            if (email && selectedPreviewType) {
                              testEmailMutation.mutate({ campaignType: selectedPreviewType, testEmail: email });
                            }
                          }
                        }}
                      />
                      <Button
                        onClick={(e) => {
                          const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                          const email = input?.value;
                          if (email && selectedPreviewType) {
                            testEmailMutation.mutate({ campaignType: selectedPreviewType, testEmail: email });
                          }
                        }}
                        disabled={testEmailMutation.isPending}
                      >
                        Send Test
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400">
                    <strong>Note:</strong> Test emails will be sent immediately with placeholder data. 
                    They will appear in the campaign list with status "sent" and trigger event "admin_test".
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}