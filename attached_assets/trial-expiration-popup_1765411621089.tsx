import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Crown, Clock, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import DeeperLogo from "@/components/deeper-logo";

interface TrialExpirationPopupProps {
  isOpen: boolean;
  onClose: () => void;
  action?: string;
}

export function TrialExpirationPopup({ isOpen, onClose, action = "continue" }: TrialExpirationPopupProps) {
  const getActionMessage = () => {
    switch (action) {
      case "messaging":
        return "Continue your meaningful conversations";
      case "invite":
        return "Send invitations to connect with others";
      case "create_conversation":
        return "Start new conversation threads";
      default:
        return "Continue using Deeper";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none [&>button]:hidden">
        {/* Beautiful parchment-style popup */}
        <div 
          className="relative bg-gradient-to-br from-white via-amber-50/40 to-amber-100/30 p-8 border border-amber-200/60 shadow-2xl"
          style={{
            background: `
              linear-gradient(135deg, 
                rgba(255,255,255,0.98) 0%, 
                rgba(255,251,235,0.96) 30%, 
                rgba(255,248,220,0.94) 70%, 
                rgba(255,245,210,0.92) 100%
              )
            `,
            filter: 'drop-shadow(0px 8px 24px rgba(0, 0, 0, 0.12))',
            backdropFilter: 'blur(1px)',
            clipPath: `polygon(
              0% 8px, 8px 0%, 
              calc(100% - 8px) 0%, 100% 8px,
              100% calc(100% - 8px), calc(100% - 8px) 100%,
              8px 100%, 0% calc(100% - 8px)
            )`,
            borderRadius: 0
          }}
        >
          {/* Subtle paper texture */}
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_20%,_rgba(139,69,19,0.08)_0%,_transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,_rgba(160,82,45,0.06)_0%,_transparent_50%)]"></div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 transition-colors z-10"
          >
            ×
          </button>

          <div className="relative z-10 text-center space-y-6">
            {/* Header with ocean blue accent */}
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-ocean/20 to-ocean/30 flex items-center justify-center mx-auto shadow-lg">
                <Clock className="w-8 h-8 text-ocean" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-slate-800 font-inter mb-2">
                  Your Free Trial Has Ended
                </h3>
                <div className="w-12 h-0.5 bg-gradient-to-r from-ocean/60 to-ocean/80 mx-auto rounded-full"></div>
              </div>
            </div>

            {/* Special offer text */}
            <div className="space-y-3">
              <p className="text-base text-slate-700 font-serif leading-relaxed">
                Your trial has ended, but here's an exclusive offer just for you!
              </p>
              
              <p className="text-sm text-slate-600 font-serif leading-relaxed italic">
                All your conversations and connections are safely preserved. Join Deeper now and continue where you left off.
              </p>
            </div>

            {/* Special discount offer */}
            <Card className="bg-gradient-to-br from-amber/10 to-amber/20 border-amber/30 shadow-lg">
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center px-3 py-1 bg-amber-200 text-amber-800 text-xs font-semibold rounded-full">
                    50% OFF LIMITED TIME
                  </div>
                  <div>
                    <div className="flex items-center justify-center space-x-2 mb-1">
                      <Crown className="w-5 h-5 text-amber-600" />
                      <span className="text-lg font-bold text-slate-800">Advanced Plan</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                      <span className="line-through text-slate-500 text-lg">$9.95</span>
                      <span className="ml-2 text-amber-600">$4.95</span>
                      <span className="text-sm font-normal text-slate-600">/month</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 italic">
                    Cheaper and more effective than having coffee once a month with your Deeper partner!
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="space-y-6">
              <Link href="/checkout/advanced?discount=50">
                <Button
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-blue/25 transition-all duration-200 font-medium"
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Subscribe Now - 50% Off
                </Button>
              </Link>
              
              <Link href="/pricing">
                <Button
                  variant="outline"
                  className="w-full py-3 border-ocean/30 text-ocean hover:bg-ocean/5 hover:border-ocean/50"
                >
                  Learn More
                </Button>
              </Link>
              
              <div className="pt-4">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="w-full py-3 bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-amber-400/40 text-amber-700 hover:from-amber-500/20 hover:to-amber-600/20 hover:border-amber-500/60 hover:text-amber-800 transition-all duration-200 font-medium"
                >
                  Maybe Later
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default TrialExpirationPopup;