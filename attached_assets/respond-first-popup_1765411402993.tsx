import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

interface RespondFirstPopupProps {
  isOpen: boolean;
  onClose: () => void;
  otherParticipantName?: string;
}

export function RespondFirstPopup({ isOpen, onClose, otherParticipantName = "the other person" }: RespondFirstPopupProps) {
  // Production-ready error handling and accessibility
  const handleClose = () => {
    try {
      onClose();
    } catch (error) {
      console.error('Error closing respond first popup:', error);
    }
  };
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-ocean/10 via-teal/5 to-ocean/5 border-2 border-ocean/20 shadow-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-ocean to-teal rounded-full flex items-center justify-center shadow-lg">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-semibold text-ocean mb-2">
            Respond First
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="bg-white/70 rounded-lg p-4 border border-ocean/20">
            <p className="text-slate-800 leading-relaxed">
              <span className="font-semibold">{otherParticipantName}</span> has asked you a question in the current conversation. You must respond at least once before you can reopen previous threads.
            </p>
          </div>
          
          <div className="text-sm text-ocean/80 bg-ocean/10 rounded-lg p-3 border border-ocean/20">
            <p className="font-medium mb-1">Turn-Based Flow</p>
            <p>Complete the current question-response exchange, then you'll be able to explore other conversation topics.</p>
          </div>
          
          <Button 
            onClick={handleClose}
            className="w-full bg-gradient-to-r from-ocean to-teal hover:from-ocean/90 hover:to-teal/90 text-white border-0 shadow-lg"
          >
            I'll Respond First
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}