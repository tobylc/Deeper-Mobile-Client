import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import DeeperLogo from "@/components/deeper-logo";

interface NoAccountPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSignUp: () => void;
  email: string;
}

export default function NoAccountPopup({ isOpen, onClose, onSignUp, email }: NoAccountPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 shadow-2xl rounded-3xl">
        <DialogHeader className="text-center space-y-4">
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 dark:from-blue-400 dark:via-blue-500 dark:to-blue-600 flex items-center justify-center shadow-lg">
              <DeeperLogo size="lg" className="text-white drop-shadow-sm" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="text-xl font-inter font-semibold text-slate-900 dark:text-white">
                No Account Found
              </DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-300 font-inter">
                We couldn't find an account with this email address
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        
        <div className="space-y-4 pt-2">
          <div className="text-center space-y-2">
            <p className="text-sm text-slate-600 dark:text-slate-300 font-inter">
              <strong className="text-slate-900 dark:text-white">{email}</strong> isn't registered with Deeper yet
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-inter">
              Would you like to create an account to get started?
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={onSignUp}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-inter font-medium py-3 rounded-3xl transition-all duration-200 group shadow-lg"
            >
              Create Account
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button 
              onClick={onClose}
              variant="ghost"
              className="w-full font-inter font-medium py-2 rounded-3xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Try Different Email
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}