import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, Trash2, Square, Pause, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import ThoughtfulResponsePopup from "@/components/thoughtful-response-popup";

interface VoiceRecorderProps {
  onSendVoiceMessage: (audioBlob: Blob, duration: number) => void;
  onRecordingStart?: () => void;
  disabled?: boolean;
  className?: string;
  canSendMessage?: boolean;
  hasStartedResponse?: boolean;
  responseStartTime?: Date | null;
  onTimerStart?: () => void;
  messages?: any[];
  connection?: any;
  currentUserEmail?: string;
  nextMessageType?: 'question' | 'response' | 'follow up';
  isFromQuestionSuggestions?: boolean;
}

export default function VoiceRecorder({ 
  onSendVoiceMessage, 
  onRecordingStart, 
  disabled, 
  className,
  canSendMessage = true,
  hasStartedResponse = false,
  responseStartTime = null,
  onTimerStart,
  messages = [],
  connection,
  currentUserEmail,
  nextMessageType,
  isFromQuestionSuggestions = false
}: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [isManuallyPaused, setIsManuallyPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volumeLevel, setVolumeLevel] = useState(0); // 0-100
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [showThoughtfulResponseTimer, setShowThoughtfulResponseTimer] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const volumeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Animation frame for mic level indicator
  useEffect(() => {
    let animationFrame: number;
    
    const updateAnimation = () => {
      if (isRecording && !isPaused) {
        // Force re-render for smooth animation
        setVolumeLevel(prev => prev);
      }
      animationFrame = requestAnimationFrame(updateAnimation);
    };
    
    if (isRecording) {
      animationFrame = requestAnimationFrame(updateAnimation);
    }
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isRecording, isPaused]);

  // Debug logging for state changes
  useEffect(() => {
    console.log('Voice recorder state changed - isRecording:', isRecording, 'isPaused:', isPaused, 'isManuallyPaused:', isManuallyPaused);
  }, [isRecording, isPaused, isManuallyPaused]);

  const clearRecording = () => {
    setIsRecording(false);
    setIsPaused(false);
    setIsManuallyPaused(false);
    setHasRecording(false);
    setDuration(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setVolumeLevel(0);
    setIsPlayingPreview(false);
    setPreviewCurrentTime(0);
    audioChunksRef.current = [];
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {
        // Ignore AudioContext close errors in production
      });
      audioContextRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getRemainingTime = () => {
    if (!hasStartedResponse || !responseStartTime) return 0;
    const elapsed = Math.floor((currentTime.getTime() - responseStartTime.getTime()) / 1000);
    return Math.max(0, 600 - elapsed); // 10 minutes = 600 seconds
  };

  const canSendNow = () => {
    // Determine actual message type: if from question suggestions, always use "question"
    const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
    
    // Always allow questions immediately (no timer for any questions)
    if (messageType === 'question') {
      return true;
    }
    
    // For responses: apply 10-minute thoughtful response timer
    if (messageType === 'response') {
      if (!hasStartedResponse) {
        return true; // Timer hasn't started yet
      }
      
      // Check if 10 minutes have passed since response started
      return getRemainingTime() === 0;
    }
    
    // For follow-ups and other message types, allow sending immediately
    return true;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      });
      
      onRecordingStart?.();
      
      // Trigger timer only for responses (not questions)
      const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
      if (messageType === 'response' && onTimerStart && !hasStartedResponse) {
        onTimerStart();
      }

      // Set up audio analysis for volume levels
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Use the most compatible audio format available - prioritize MP4 for better browser support
      let options: MediaRecorderOptions = {};
      let selectedFormat = 'none';
      
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { mimeType: 'audio/mp4' };
        selectedFormat = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        options = { mimeType: 'audio/wav' };
        selectedFormat = 'audio/wav';
      } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { mimeType: 'audio/webm;codecs=opus' };
        selectedFormat = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/webm' };
        selectedFormat = 'audio/webm';
      }
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Selected audio recording format:', selectedFormat);
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('MediaRecorder stopped - recorder state was:', mediaRecorderRef.current?.state);
        }
        // Use the same MIME type that was used for recording
        const mimeType = (options as any).mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        setHasRecording(true);
        setIsRecording(false);
        setIsPaused(false);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.onpause = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('MediaRecorder paused successfully');
        }
      };

      mediaRecorder.onresume = () => {
        if (process.env.NODE_ENV === 'development') {
          console.log('MediaRecorder resumed successfully');
        }
      };

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setIsPaused(false);

      // Start duration timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= 30 * 60) { // 30 minutes max
            stopRecording();
            return 30 * 60;
          }
          return newDuration;
        });
      }, 1000);
      
      // Start volume level monitoring with delay for audio context setup
      setTimeout(() => {
        volumeTimerRef.current = setInterval(() => {
          if (analyserRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
            setVolumeLevel(Math.min(100, (average / 128) * 100));
          } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
            // Keep volume level low when paused
            setVolumeLevel(5);
          }
        }, 50);
      }, 1000);
      
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error accessing microphone:', error);
      }
      
      // Production-ready error messaging
      let errorMessage = 'Unable to access microphone';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied. Please allow microphone access and try again.';
      } else if (error.name === 'NotFoundError') {
        errorMessage = 'No microphone found. Please connect a microphone and try again.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'Microphone is being used by another application. Please close other applications and try again.';
      }
      
      // You can add toast notification here if needed
      alert(errorMessage);
    }
  };

  const pauseRecording = () => {
    console.log('pauseRecording called - before:', { isRecording, isPaused, isManuallyPaused });
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      setIsManuallyPaused(true);
      console.log('Recording paused, setting states to true');
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      setIsManuallyPaused(false);
      if (process.env.NODE_ENV === 'development') {
        console.log('Recording resumed, isPaused state set to false');
      }
      // Resume timer
      timerRef.current = setInterval(() => {
        setDuration(prev => {
          const newDuration = prev + 1;
          if (newDuration >= 30 * 60) { // 30 minutes max
            stopRecording();
            return 30 * 60;
          }
          return newDuration;
        });
      }, 1000);
    } else if (isManuallyPaused) {
      // If MediaRecorder stopped but we were manually paused, restart recording
      setIsManuallyPaused(false);
      setIsPaused(false);
      if (process.env.NODE_ENV === 'development') {
        console.log('Restarting recording after MediaRecorder stopped during pause');
      }
      // Continue the existing recording session
      startRecording();
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setIsPaused(false);
    setIsManuallyPaused(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (volumeTimerRef.current) {
      clearInterval(volumeTimerRef.current);
      volumeTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {
        // Ignore AudioContext close errors in production
      });
      audioContextRef.current = null;
    }
  };

  const handleSendAttempt = async () => {
    // Check timer requirements only for responses
    const messageType = isFromQuestionSuggestions ? 'question' : nextMessageType;
    if (messageType === 'response' && hasStartedResponse && !canSendNow()) {
      setShowThoughtfulResponseTimer(true);
      return;
    }
    
    if (audioBlob && canSendMessage) {
      try {
        await onSendVoiceMessage(audioBlob, duration);
        clearRecording();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error sending voice message:', error);
        }
        // Don't clear recording on error so user can retry
      }
    }
  };

  const handleThoughtfulResponseProceed = async () => {
    if (audioBlob && canSendMessage && canSendNow()) {
      try {
        await onSendVoiceMessage(audioBlob, duration);
        clearRecording();
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error sending voice message:', error);
        }
        // Don't clear recording on error so user can retry
      }
    }
    setShowThoughtfulResponseTimer(false);
  };

  // Get volume level color for visual feedback
  const getVolumeColor = (volume: number) => {
    if (volume < 30) return '#10B981'; // green
    if (volume < 70) return '#F59E0B'; // yellow  
    return '#EF4444'; // red
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Only log state changes, not every render
  const [lastLoggedState, setLastLoggedState] = useState<{isRecording: boolean, isPaused: boolean} | null>(null);
  if (process.env.NODE_ENV === 'development' && (
    !lastLoggedState || 
    lastLoggedState.isRecording !== isRecording || 
    lastLoggedState.isPaused !== isPaused
  )) {
    console.log('Voice recorder state changed - isRecording:', isRecording, 'isPaused:', isPaused);
    setLastLoggedState({isRecording, isPaused});
  }

  return (
    <>
      <div className={cn("flex items-center space-x-2 px-2 py-0.5", className)}>
        {/* Recording Status Indicator */}
        <div className="flex items-center space-x-1">
          {isRecording ? (
            <div className="flex items-center space-x-2">
              {/* Mic Level Line Indicator */}
              <div className="flex items-center space-x-0.5">
                {Array.from({ length: 8 }).map((_, i) => {
                  const barHeight = isPaused 
                    ? 2 
                    : Math.max(2, Math.min(12, (volumeLevel / 100) * 8 + Math.sin(Date.now() / 200 + i) * 2));
                  return (
                    <div
                      key={i}
                      className="w-0.5 bg-slate-300 rounded-full transition-all duration-100"
                      style={{
                        height: `${barHeight}px`,
                        backgroundColor: isPaused ? '#94a3b8' : getVolumeColor(volumeLevel),
                        opacity: isPaused ? 0.4 : 1
                      }}
                    />
                  );
                })}
              </div>
              <span className="text-xs text-slate-600 font-mono">
                {formatDuration(duration)}
              </span>
            </div>
          ) : hasRecording ? (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-xs text-slate-600">Ready</span>
            </div>
          ) : (
            <span className="text-xs text-slate-400">Tap to record</span>
          )}
        </div>

        {/* Main Recording Button - Compact */}
        <Button
          onClick={() => {
            console.log('Button clicked - states:', { isRecording, isPaused, isManuallyPaused });
            if (!isRecording && !isManuallyPaused) {
              startRecording();
            } else if (isPaused || isManuallyPaused) {
              resumeRecording();
            } else {
              pauseRecording();
            }
          }}
          disabled={disabled}
          className={cn(
            "w-6 h-6 rounded-full transition-all duration-200 text-white flex-shrink-0",
            // Show amber background when paused (either state) - use !important style override
            (isPaused || isManuallyPaused)
              ? "!bg-amber-500 hover:!bg-amber-600 animate-pulse border-2 border-amber-300"
              : isRecording
                ? "bg-red-500 hover:bg-red-600" 
                : "bg-[#4FACFE] hover:bg-[#4FACFE]/90"
          )}
          style={(isPaused || isManuallyPaused) ? {
            backgroundColor: '#f59e0b',
            borderColor: '#fcd34d',
            boxShadow: '0 0 8px rgba(245, 158, 11, 0.6)',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          } : {}}
        >
          {/* Show Mic icon when paused, Pause when recording, Mic when not recording */}
          {(isPaused || isManuallyPaused) ? (
            <Mic className="w-3 h-3" />
          ) : isRecording ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Mic className="w-3 h-3" />
          )}
        </Button>

        {/* Stop Recording Button */}
        {(isRecording || isManuallyPaused) && (
          <Button
            onClick={stopRecording}
            className="w-6 h-6 rounded-full bg-slate-500 hover:bg-slate-600 text-white transition-all duration-200 flex-shrink-0"
          >
            <Square className="w-3 h-3" />
          </Button>
        )}

        {/* Clear Recording Button */}
        {hasRecording && !isRecording && (
          <Button
            onClick={clearRecording}
            className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white transition-all duration-200 flex-shrink-0"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}

        {/* Recording Progress - Inline */}
        {(isRecording || isManuallyPaused) && (
          <div className="flex-1 max-w-24">
            <div className="w-full bg-slate-200 rounded-full h-1">
              <div 
                className="bg-[#4FACFE] h-1 rounded-full transition-all duration-500" 
                style={{ width: `${Math.min((duration / (30 * 60)) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Playback Controls for Recorded Audio */}
        {hasRecording && !isRecording && audioUrl && (
          <div className="flex items-center space-x-1">
            <Button
              onClick={() => setIsPlayingPreview(!isPlayingPreview)}
              className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white transition-all duration-200 flex-shrink-0"
            >
              {isPlayingPreview ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            </Button>
            
            {/* Preview Progress */}
            {isPlayingPreview && (
              <div className="flex-1 max-w-16">
                <div className="w-full bg-slate-200 rounded-full h-1">
                  <div 
                    className="bg-blue-500 h-1 rounded-full transition-all duration-100" 
                    style={{ width: `${(previewCurrentTime / duration) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Send Button */}
        {hasRecording && (
          <div className="flex items-center space-x-1">
            <Button
              onClick={handleSendAttempt}
              disabled={!canSendMessage}
              className={cn(
                "w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 text-white transition-all duration-200 flex-shrink-0",
                !canSendMessage && "opacity-50 cursor-not-allowed"
              )}
            >
              <Send className="w-3 h-3" />
            </Button>
            {/* Timer countdown for responses only */}
            {!isFromQuestionSuggestions && nextMessageType === 'response' && hasStartedResponse && !canSendNow() && (
              <span className="text-xs text-slate-500 font-mono">
                {formatTime(getRemainingTime())}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Thoughtful Response Timer Popup */}
      <ThoughtfulResponsePopup
        isOpen={showThoughtfulResponseTimer}
        onClose={() => setShowThoughtfulResponseTimer(false)}
        onProceed={handleThoughtfulResponseProceed}
        remainingSeconds={getRemainingTime()}
      />
    </>
  );
}