import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { UserDisplayName } from "@/hooks/useUserDisplayName";
import { Mail, ExternalLink } from "lucide-react";

interface Email {
  id: number;
  toEmail: string;
  fromEmail: string;
  subject: string;
  emailType: string;
  status: string;
  connectionId?: number;
  sentAt: string;
}

export default function EmailsPage() {
  const { user } = useAuth();

  const { data: emails = [], isLoading } = useQuery<Email[]>({
    queryKey: ['/api/emails', user?.email],
    enabled: !!user?.email,
  });

  const openEmailPreview = (emailId: number) => {
    window.open(`/api/emails/view/${emailId}`, '_blank');
  };

  const getEmailTypeColor = (type: string) => {
    switch (type) {
      case 'invitation': return 'bg-blue-100 text-blue-800';
      case 'acceptance': return 'bg-green-100 text-green-800';
      case 'decline': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1B2137] via-[#1B2137] to-[#2A3B5C] p-6">
        <div className="container mx-auto">
          <div className="text-center text-white">Loading emails...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B2137] via-[#1B2137] to-[#2A3B5C] p-6">
      <div className="container mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Email Notifications</h1>
          <p className="text-gray-300">View all email notifications stored in your internal system</p>
        </div>

        {/* Email List */}
        <div className="space-y-4">
          {emails.length === 0 ? (
            <Card className="bg-white/10 backdrop-blur-md border-white/20">
              <CardContent className="p-8 text-center">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">No emails yet</h3>
                <p className="text-gray-300">Email notifications will appear here when you send invitations</p>
              </CardContent>
            </Card>
          ) : (
            emails.map((email) => (
              <Card key={email.id} className="bg-white/10 backdrop-blur-md border-white/20 hover:bg-white/15 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-white text-lg mb-2">{email.subject}</CardTitle>
                      <div className="flex items-center gap-3 text-sm text-gray-300">
                        <span>To: <UserDisplayName email={email.toEmail} /></span>
                        <span>•</span>
                        <span>From: <UserDisplayName email={email.fromEmail} /></span>
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(email.sentAt), { addSuffix: true })}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getEmailTypeColor(email.emailType)}>
                        {email.emailType}
                      </Badge>
                      <Badge variant="outline" className="text-gray-300 border-gray-600">
                        {email.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex justify-between items-center">
                    <div className="text-gray-400 text-sm">
                      Connection ID: {email.connectionId || 'N/A'}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEmailPreview(email.id)}
                      className="text-white border-white/30 hover:bg-white/10"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Email
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}