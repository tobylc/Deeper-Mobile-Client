import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight } from "lucide-react";
import QuotesIcon from "@/components/quotes-icon";

interface ExchangeRequiredPopupProps {
  isOpen: boolean;
  onClose: () => void;
  nextMessageType: 'question' | 'response';
  relationshipType: string;
}

export default function ExchangeRequiredPopup({ 
  isOpen, 
  onClose, 
  nextMessageType,
  relationshipType 
}: ExchangeRequiredPopupProps) {
  // Debug logging when popup opens
  if (isOpen) {
    console.log('[EXCHANGE_REQUIRED_POPUP] Popup opened with:', {
      nextMessageType,
      relationshipType,
      timestamp: new Date().toISOString()
    });
  }
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
        <DialogHeader className="sr-only">
          <DialogTitle>
            {nextMessageType === 'response' ? 'Response Needed First' : 'Initial Exchange Required'}
          </DialogTitle>
          <DialogDescription>
            {nextMessageType === 'response' 
              ? 'Please respond to the current question in the conversation before asking a new question.'
              : 'Complete at least one question-response exchange before starting new conversation threads.'
            }
          </DialogDescription>
        </DialogHeader>
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
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_80%,_rgba(139,69,19,0.06)_0%,_transparent_50%)]"></div>
          </div>
          
          {/* Very subtle ruled lines */}
          <div className="absolute inset-0 opacity-15 pointer-events-none" 
               style={{
                 backgroundImage: 'repeating-linear-gradient(transparent, transparent 23px, rgba(139,69,19,0.2) 23px, rgba(139,69,19,0.2) 24px)',
               }} />

          <div className="relative z-10 text-center space-y-6">
            {/* Header with ocean blue accent */}
            <div className="space-y-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-ocean/20 to-ocean/30 flex items-center justify-center mx-auto shadow-lg">
                <QuotesIcon size="lg" className="text-ocean" />
              </div>
              
              <div>
                <h3 className="text-xl font-bold text-slate-800 font-inter mb-2">
                  {nextMessageType === 'response' ? 'Response Needed First' : 'Initial Exchange Required'}
                </h3>
                <div className="w-12 h-0.5 bg-gradient-to-r from-ocean/60 to-ocean/80 mx-auto rounded-full"></div>
              </div>
            </div>

            {/* Explanation text */}
            <div className="space-y-3">
              <p className="text-base text-slate-700 font-serif leading-relaxed">
                {nextMessageType === 'response' 
                  ? 'Please respond to the current question in the conversation before asking a new question.'
                  : 'Complete at least one question-response exchange before starting new conversation threads.'
                }
              </p>
              
              <p className="text-sm text-slate-600 font-serif leading-relaxed italic">
                This thoughtful approach helps build deeper conversations, one exchange at a time.
              </p>
            </div>

            {/* Action flow indicator */}
            <div className="flex items-center justify-center space-x-3 py-4">
              <div className="flex items-center space-x-2 px-3 py-2 bg-ocean/10 rounded-lg border border-ocean/20">
                <MessageCircle className="w-4 h-4 text-ocean" />
                <span className="text-xs font-medium text-ocean">
                  {nextMessageType === 'response' ? 'Respond' : 'Ask & Answer'}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-400" />
              <div className="flex items-center space-x-2 px-3 py-2 bg-amber-100/60 rounded-lg border border-amber-200/40">
                <QuotesIcon size="sm" className="text-amber-700" />
                <span className="text-xs font-medium text-amber-700">New Questions</span>
              </div>
            </div>

            {/* Close button */}
            <Button
              onClick={onClose}
              className="w-full bg-gradient-to-r from-ocean to-ocean/90 hover:from-ocean/90 hover:to-ocean text-white shadow-lg hover:shadow-ocean/25 transition-all duration-200 font-medium"
            >
              Continue Conversation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}