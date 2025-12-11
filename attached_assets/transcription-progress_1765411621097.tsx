import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Mic, Sparkles, Send, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface TranscriptionProgressProps {
  isVisible: boolean;
  onComplete?: () => void;
  className?: string;
  isProcessingComplete?: boolean;
}

export default function TranscriptionProgress({ 
  isVisible, 
  onComplete, 
  className,
  isProcessingComplete = false
}: TranscriptionProgressProps) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<'uploading' | 'processing' | 'transcribing' | 'sending' | 'complete'>('uploading');

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setStage('uploading');
      return;
    }

    // Simulate realistic voice message processing with multiple stages
    // Progress automatically to 95% but wait for isProcessingComplete to finish
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev < 15) {
          setStage('uploading');
          return prev + Math.random() * 4 + 3; // 3-7% increments in upload phase
        } else if (prev < 35) {
          setStage('processing');
          return prev + Math.random() * 6 + 2; // 2-8% increments in processing phase
        } else if (prev < 75) {
          setStage('transcribing');
          return prev + Math.random() * 5 + 2; // 2-7% increments in transcription phase
        } else if (prev < 95) {
          setStage('sending');
          return prev + Math.random() * 4 + 1; // 1-5% increments in sending phase
        } else {
          // Wait at 95% until processing is complete
          return 95;
        }
      });
    }, 120 + Math.random() * 80); // Variable timing for realistic feel

    return () => clearInterval(interval);
  }, [isVisible]);

  // Handle completion when processing is done
  useEffect(() => {
    if (isProcessingComplete && progress >= 95) {
      setProgress(100);
      setStage('complete');
      setTimeout(() => {
        onComplete?.();
      }, 800);
    }
  }, [isProcessingComplete, progress, onComplete]);

  if (!isVisible) return null;

  const getStageText = () => {
    switch (stage) {
      case 'uploading':
        return 'Uploading voice message...';
      case 'processing':
        return 'Processing audio...';
      case 'transcribing':
        return 'AI transcribing speech...';
      case 'sending':
        return 'Sending message...';
      case 'complete':
        return 'Message sent successfully!';
      default:
        return 'Processing...';
    }
  };

  const getStageIcon = () => {
    switch (stage) {
      case 'uploading':
        return <Mic className="w-5 h-5 text-white" />;
      case 'processing':
        return <Mic className="w-5 h-5 text-white" />;
      case 'transcribing':
        return <Sparkles className="w-5 h-5 text-white" />;
      case 'sending':
        return <Send className="w-5 h-5 text-white" />;
      case 'complete':
        return <CheckCircle className="w-5 h-5 text-white" />;
      default:
        return <Mic className="w-5 h-5 text-white" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <Card className={cn(
        "p-6 max-w-md bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700 shadow-2xl",
        "animate-in fade-in-0 scale-in-95 duration-300",
        className
      )}>
        <div className="flex items-center space-x-4">
          {/* Stage Icon with Animation */}
          <div className="relative">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
              stage === 'complete' 
                ? "bg-gradient-to-br from-green-500 to-green-600" 
                : "bg-gradient-to-br from-ocean to-ocean/80"
            )}>
              {getStageIcon()}
            </div>
            {/* Pulsing ring animation */}
            <div className={cn(
              "absolute inset-0 rounded-full border-2 animate-ping opacity-40",
              stage === 'complete' ? "border-green-400" : "border-ocean/60"
            )} />
          </div>

          {/* Progress Content */}
          <div className="flex-1 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-white">
                {getStageText()}
              </span>
              <span className="text-sm font-mono text-slate-300 bg-slate-700 px-3 py-1 rounded-full">
                {Math.round(progress)}%
              </span>
            </div>
            
            {/* Progress Bar */}
            <div className="h-3 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-300 ease-out",
                  stage === 'complete'
                    ? "bg-gradient-to-r from-green-500 to-green-600"
                    : "bg-gradient-to-r from-ocean to-teal"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="text-sm text-slate-400">
              {stage === 'transcribing' && "Using OpenAI Whisper for accurate transcription"}
              {stage === 'complete' && "Voice message ready! Refreshing page..."}
              {(stage === 'uploading' || stage === 'processing') && "Preparing your voice message"}
              {stage === 'sending' && "Adding to conversation"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}