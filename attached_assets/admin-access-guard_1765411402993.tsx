import { useAuth } from "@/hooks/useAuth";
import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface AdminAccessGuardProps {
  children: ReactNode;
}

export default function AdminAccessGuard({ children }: AdminAccessGuardProps) {
  const { user, isLoading } = useAuth();

  // Check if user is admin (you can modify this logic based on your admin setup)
  const adminEmails = [
    'toby@gowithclark.com',
    'thetobyclarkshow@gmail.com', 
    'tobylc@mac.com'
  ];
  const isAdmin = user?.email && adminEmails.includes(user.email);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-r from-ocean to-teal flex items-center justify-center p-3">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <Card className="max-w-md w-full bg-slate-800 border-slate-700">
          <CardContent className="p-8 text-center">
            <Shield className="h-16 w-16 text-slate-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Access Restricted</h2>
            <p className="text-slate-300 mb-6">
              You don't have permission to access the admin portal. This area is restricted to authorized administrators only.
            </p>
            <Link href="/dashboard">
              <Button className="w-full bg-ocean hover:bg-blue-600">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}