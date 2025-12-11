import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface WaitingTurnPopupProps {
  isOpen: boolean;
  onClose: () => void;
  otherParticipantName?: string;
}

export function WaitingTurnPopup({ isOpen, onClose, otherParticipantName = "the other person" }: WaitingTurnPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 border-2 border-amber-200/50 shadow-2xl">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-ocean to-teal rounded-full flex items-center justify-center shadow-lg">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-xl font-semibold text-amber-900 mb-2">
            It's Their Turn
          </DialogTitle>
        </DialogHeader>
        
        <div className="text-center space-y-4">
          <div className="bg-white/70 rounded-lg p-4 border border-amber-200">
            <p className="text-amber-800 leading-relaxed">
              You need to wait for <span className="font-semibold">{otherParticipantName}</span> to take their turn before you can reopen previous conversations or start new ones.
            </p>
          </div>
          
          <div className="text-sm text-amber-700 bg-amber-100/50 rounded-lg p-3 border border-amber-200">
            <p className="font-medium mb-1">Turn-Based Communication</p>
            <p>Deeper uses thoughtful turn-based conversations. Once they respond, you'll be able to continue or explore other conversation topics.</p>
          </div>
          
          <Button 
            onClick={onClose}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0 shadow-lg"
          >
            I'll Wait
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}