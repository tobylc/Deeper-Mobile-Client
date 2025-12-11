import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, Heart, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import QuotesIcon from "@/components/quotes-icon";

interface ThoughtfulResponsePopupProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  remainingSeconds: number;
}

export default function ThoughtfulResponsePopup({ 
  isOpen, 
  onClose, 
  onProceed, 
  remainingSeconds 
}: ThoughtfulResponsePopupProps) {
  const [timeLeft, setTimeLeft] = useState(remainingSeconds);

  useEffect(() => {
    if (isOpen && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, timeLeft]);

  useEffect(() => {
    setTimeLeft(remainingSeconds);
  }, [remainingSeconds]);

  const formatTime = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const canProceed = timeLeft <= 0;

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-hidden flex flex-col bg-gradient-radial from-slate-900 via-slate-800 to-slate-900 border-2 border-[#D7A087]/50 backdrop-blur-md">
        <DialogHeader className="text-center space-y-4 pt-2 flex-shrink-0">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-[#D7A087] to-amber-400 flex items-center justify-center shadow-lg">
              <Clock className="w-8 h-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-xl font-bold text-white flex items-center justify-center space-x-2">
            <QuotesIcon size="md" className="text-[#D7A087]" />
            <span>Take Your Time</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 flex-1 overflow-y-auto pr-2">
          {/* Main Message */}
          <Card className="bg-[#1B2137]/90 border-[#D7A087]/30 backdrop-blur-md shadow-xl">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h3 className="text-lg font-semibold text-white">
                  Are you sure you've thought through your response thoroughly?
                </h3>
                <div className="space-y-3 text-slate-200 leading-relaxed">
                  <p>
                    Please take your time to respond—there's <strong className="text-white">no rush!</strong> This conversation 
                    is not a sprint; it's meant to be a <strong className="text-white">marathon</strong>.
                  </p>
                  <p>
                    Feel free to take hours or even days if needed so you can craft the kind of response 
                    that will be <strong className="text-white">highly beneficial</strong> to the productivity of this conversation.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Countdown Timer */}
          {!canProceed && (
            <Card className="bg-gradient-to-r from-slate-50 to-white border-[#4FACFE]/30 backdrop-blur-md shadow-lg">
              <CardContent className="p-4">
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center space-x-2">
                    <Clock className="w-5 h-5 text-[#4FACFE]" />
                    <span className="text-black font-medium">Minimum reflection time remaining:</span>
                  </div>
                  <div className="text-3xl font-bold bg-gradient-to-r from-[#D7A087] to-amber-400 bg-clip-text text-transparent drop-shadow-sm tabular-nums" style={{filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.5))'}}>
                    {formatTime(timeLeft)}
                  </div>
                  <p className="text-sm text-[#4FACFE]">
                    This ensures you have adequate time to craft a thoughtful response
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Encouragement Section */}
          <Card className="bg-[#1B2137]/80 border-[#4FACFE]/30 backdrop-blur-md shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start space-x-3">
                <QuotesIcon size="sm" className="text-[#4FACFE] mt-1 flex-shrink-0" />
                <div>
                  <h5 className="font-semibold text-white mb-2">Remember</h5>
                  <ul className="space-y-1 text-sm text-slate-200">
                    <li>• Quality over speed in communication</li>
                    <li>• Authentic reflection leads to deeper connection</li>
                    <li>• Your thoughtful response is worth the wait</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-center pt-2">
            <Button 
              onClick={onClose}
              variant="outline" 
              className="border-[#4FACFE]/30 text-[#4FACFE] hover:bg-[#4FACFE]/10 px-6"
            >
              Continue Editing
            </Button>
            <Button 
              onClick={onProceed}
              disabled={!canProceed}
              className={`px-6 ${
                canProceed 
                  ? 'bg-gradient-to-r from-[#D7A087] to-amber-400 text-white hover:from-[#D7A087]/90 hover:to-amber-400/90' 
                  : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }`}
            >
              {canProceed ? (
                <>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Send Response
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 mr-2" />
                  Please Wait
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}