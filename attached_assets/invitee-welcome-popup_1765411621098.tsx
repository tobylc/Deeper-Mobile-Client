import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, MessageCircle, Clock, CheckCircle } from "lucide-react";
import DeeperLogo from "@/components/deeper-logo";
import QuotesIcon from "@/components/quotes-icon";
import { getRoleDisplayInfo, getInvitationText } from "@shared/role-display-utils";

interface InviteeWelcomePopupProps {
  inviterName: string;
  relationshipType: string;
  inviterRole?: string;
  inviteeRole?: string;
  onClose: () => void;
}

export default function InviteeWelcomePopup({ 
  inviterName, 
  relationshipType,
  inviterRole,
  inviteeRole,
  onClose 
}: InviteeWelcomePopupProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in after a short delay
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for animation to complete
  };

  return (
    <div className={`
      fixed inset-0 z-50 flex items-center justify-center p-4
      bg-black/60 backdrop-blur-sm transition-all duration-300
      ${isVisible ? 'opacity-100' : 'opacity-0'}
    `}>
      <Card className={`
        max-w-lg w-full bg-card/95 border-border backdrop-blur-md
        transform transition-all duration-300
        ${isVisible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'}
      `}>
        <CardHeader className="relative pb-4">
          <Button
            onClick={handleClose}
            variant="ghost"
            size="sm"
            className="absolute right-2 top-2 h-8 w-8 p-0 hover:bg-muted rounded-full"
          >
            <X className="h-4 w-4" />
          </Button>
          
          <div className="flex flex-col items-center text-center mb-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-white font-inter">Welcome to</span>
              <DeeperLogo size="md" />
            </div>
            <p className="text-sm text-[#4FACFE] font-inter">
              Your connection journey begins here
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Connection Established */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#4FACFE]/10 to-teal/10 border border-[#4FACFE]/20">
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle className="w-5 h-5 text-[#4FACFE]" />
              <h3 className="font-semibold text-white font-inter">
                Connection Established
              </h3>
            </div>
            <p className="text-sm text-white font-inter leading-relaxed">
              <span className="font-medium text-[#4FACFE]">{inviterName}</span> has invited you to connect as{' '}
              <span className="font-medium text-[#4FACFE]">
                {inviterRole && inviteeRole ? 
                  getRoleDisplayInfo(relationshipType, inviterRole, inviteeRole).relationshipDisplay 
                  : relationshipType
                }
              </span>. 
              Your account has been created and you're ready to begin meaningful conversations.
            </p>
          </div>

          {/* What Happens Next */}
          <div className="space-y-4">
            <h3 className="font-semibold text-white font-inter flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#4FACFE]" />
              What happens next?
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#4FACFE]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#4FACFE]">1</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white font-inter">
                    Wait for {inviterName} to start your first conversation
                  </p>
                  <p className="text-xs text-[#4FACFE] font-inter">
                    They'll choose a meaningful question to begin your dialogue
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#4FACFE]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#4FACFE]">2</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white font-inter">
                    You'll receive an email notification
                  </p>
                  <p className="text-xs text-[#4FACFE] font-inter">
                    When it's your turn to respond in the conversation
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#4FACFE]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-[#4FACFE]">3</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white font-inter">
                    Engage in turn-based meaningful dialogue
                  </p>
                  <p className="text-xs text-[#4FACFE] font-inter">
                    Take turns asking questions and sharing thoughtful responses
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tips for Great Conversations */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-[#4FACFE]/10 to-teal/10 border border-[#4FACFE]/20">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="w-4 h-4 text-[#4FACFE]" />
              <h4 className="text-sm font-semibold text-white font-inter">
                Tips for meaningful conversations
              </h4>
            </div>
            <ul className="text-xs text-white font-inter space-y-1">
              <li>• Be open and authentic in your responses</li>
              <li>• Take time to thoughtfully consider each question</li>
              <li>• Ask follow-up questions to deepen understanding</li>
              <li>• Share personal experiences and emotions</li>
            </ul>
          </div>

          {/* Close Button */}
          <Button
            onClick={handleClose}
            className="w-full btn-ocean font-inter rounded-2xl py-3"
          >
            <DeeperLogo size="sm" className="brightness-0 invert mr-2" />
            I'm Ready to Connect
          </Button>

          <p className="text-xs text-center text-white font-inter">
            You can always return to your dashboard to check for new conversations
          </p>
        </CardContent>
      </Card>
    </div>
  );
}