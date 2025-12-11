import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Users, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CleanupResult {
  success: boolean;
  merged: number;
  message: string;
  error?: string;
}

export default function AdminCleanup() {
  const [isRunning, setIsRunning] = useState(false);
  const [lastResult, setLastResult] = useState<CleanupResult | null>(null);
  const { toast } = useToast();

  const runCleanup = async () => {
    setIsRunning(true);
    setLastResult(null);

    try {
      const response = await apiRequest("POST", "/api/admin/cleanup-users");
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Cleanup failed');
      }
      
      const result = await response.json();
      setLastResult(result);
      
      if (result.success) {
        toast({
          title: "Cleanup Completed",
          description: result.message,
        });
      } else {
        toast({
          title: "Cleanup Failed",
          description: result.message,
        });
      }
    } catch (error: any) {
      const errorMessage = error.message || "An unexpected error occurred";
      setLastResult({
        success: false,
        merged: 0,
        message: errorMessage,
        error: errorMessage
      });
      
      toast({
        title: "Cleanup Error",
        description: errorMessage,
      });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Card className="bg-card/50 border-border backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground font-inter">
          <Users className="w-5 h-5 text-ocean" />
          Admin: User Account Cleanup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <p className="text-sm text-amber-600 font-medium mb-2">
            Account Linking Issue Fix
          </p>
          <p className="text-xs text-amber-600/80">
            This utility merges duplicate Google OAuth accounts with existing email-based accounts. 
            Run this to fix cases where users have separate accounts instead of linked accounts.
          </p>
        </div>

        {lastResult && (
          <div className={`p-3 rounded-2xl border ${
            lastResult.success 
              ? 'bg-green-500/10 border-green-500/20' 
              : 'bg-red-500/10 border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.success ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400" />
              )}
              <p className={`text-sm font-medium ${
                lastResult.success ? 'text-green-400' : 'text-red-400'
              }`}>
                {lastResult.success ? 'Cleanup Successful' : 'Cleanup Failed'}
              </p>
            </div>
            <p className={`text-xs ${
              lastResult.success ? 'text-green-300/80' : 'text-red-300/80'
            }`}>
              {lastResult.message}
            </p>
            {lastResult.success && lastResult.merged > 0 && (
              <Badge variant="secondary" className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
                {lastResult.merged} accounts merged
              </Badge>
            )}
          </div>
        )}

        <Button
          onClick={runCleanup}
          disabled={isRunning}
          className="w-full bg-gradient-to-r from-ocean to-teal text-white hover:from-ocean/90 hover:to-teal/90"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Running Cleanup...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Run User Account Cleanup
            </>
          )}
        </Button>

        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Merges duplicate Google OAuth accounts with email-based accounts</p>
          <p>• Updates all connections, conversations, and messages</p>
          <p>• Safe operation - only merges confirmed duplicates</p>
          <p>• Admin access required</p>
        </div>
      </CardContent>
    </Card>
  );
}