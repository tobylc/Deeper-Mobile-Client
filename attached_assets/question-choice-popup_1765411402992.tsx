import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle, ArrowRight, HelpCircle } from 'lucide-react';

interface QuestionChoicePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSendAsNewQuestion: () => void;
  onSendAsResponse: () => void;
  messageText: string;
}

export default function QuestionChoicePopup({
  isOpen,
  onClose,
  onSendAsNewQuestion,
  onSendAsResponse,
  messageText
}: QuestionChoicePopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center space-x-2 text-slate-800">
            <HelpCircle className="w-5 h-5 text-amber-600" />
            <span>New Question or Response?</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          <div className="bg-slate-50 p-4 rounded-lg border">
            <p className="text-sm text-slate-600 mb-2">Your message:</p>
            <div className="text-sm font-medium text-slate-800 italic leading-relaxed break-words">
              "{messageText}"
            </div>
          </div>
          
          <div className="space-y-3">
            <p className="text-sm text-slate-700">
              We noticed you're asking a question. Would you like to:
            </p>
            
            <div className="grid grid-cols-1 gap-3">
              {/* New Question Option */}
              <Button
                onClick={onSendAsNewQuestion}
                className="justify-start h-auto p-4 bg-gradient-to-r from-ocean to-teal text-white hover:from-ocean/90 hover:to-teal/90 group w-full"
              >
                <div className="flex items-start space-x-3 w-full min-w-0">
                  <MessageCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-semibold mb-1">Start a New Question Thread</div>
                    <div className="text-xs text-white/90 leading-relaxed break-words">
                      This will create a new conversation thread and save your current discussion
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 mt-1 flex-shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                </div>
              </Button>
              
              {/* Response Option */}
              <Button
                onClick={onSendAsResponse}
                variant="outline"
                className="justify-start h-auto p-4 border-slate-300 hover:bg-slate-50 group w-full"
              >
                <div className="flex items-start space-x-3 w-full min-w-0">
                  <ArrowRight className="w-5 h-5 mt-0.5 flex-shrink-0 text-slate-600" />
                  <div className="text-left flex-1 min-w-0">
                    <div className="font-semibold mb-1 text-slate-800">Continue Current Thread</div>
                    <div className="text-xs text-slate-600 leading-relaxed break-words">
                      Send this as a response within the current conversation
                    </div>
                  </div>
                </div>
              </Button>
            </div>
            
            <div className="flex justify-end space-x-2 pt-2">
              <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}