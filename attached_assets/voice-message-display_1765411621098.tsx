import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Play, Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Message } from "@shared/schema";
import { 
  constructAudioUrl, 
  testAudioFileAccess, 
  loadAudioWithRecovery, 
  hasValidTranscription 
} from "@/utils/audio-helper";

interface VoiceMessageDisplayProps {
  message: Message;
  isCurrentUser: boolean;
  className?: string;
}

export default function VoiceMessageDisplay({ message, isCurrentUser, className }: VoiceMessageDisplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true); // Start with loading state
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Initialize audio with robust loading and error handling
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !message.audioFileUrl) {
      setIsLoading(false);
      setError(message.audioFileUrl ? null : 'No audio file URL');
      return;
    }

    // Reset states
    setIsLoading(true);
    setError(null);
    setIsPlaying(false);
    setCurrentTime(0);

    // Test audio file accessibility first with enhanced S3 support
    const audioUrl = constructAudioUrl(message.audioFileUrl);
    console.log('[VOICE_MESSAGE] Testing audio URL accessibility:', audioUrl);
    
    testAudioFileAccess(audioUrl, 3).then((result) => { // Increased retries for S3 latency
      if (!result.success) {
        setIsLoading(false);
        
        // Show transcription fallback if available
        if (result.canUseFallback && hasValidTranscription(message.transcription)) {
          setError(`Audio unavailable. Transcription: "${message.transcription}"`);
        } else {
          setError(result.error || 'Audio file unavailable');
        }
        return;
      }

      // File is accessible, set up audio element
      const handleInitialError = (e: Event) => {
        console.error('Audio element error:', e);
        setIsLoading(false);
        
        if (hasValidTranscription(message.transcription)) {
          setError(`Playback error. Transcription: "${message.transcription}"`);
        } else {
          setError('Audio playback unavailable');
        }
      };

      const handleInitialCanPlay = () => {
        setIsLoading(false);
        setError(null);
      };

      audio.addEventListener('error', handleInitialError);
      audio.addEventListener('canplay', handleInitialCanPlay);

      // Set source
      audio.src = audioUrl;
      audio.load();

      // Cleanup when component unmounts or URL changes
      return () => {
        audio.removeEventListener('error', handleInitialError);
        audio.removeEventListener('canplay', handleInitialCanPlay);
      };
    }).catch((error) => {
      console.error('Audio accessibility test failed:', error);
      setIsLoading(false);
      
      if (hasValidTranscription(message.transcription)) {
        setError(`Network error. Transcription: "${message.transcription}"`);
      } else {
        setError('Cannot access audio file');
      }
    });
  }, [message.audioFileUrl, message.transcription]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = async () => {
    if (!audioRef.current || !message.audioFileUrl) {
      setError('Audio file not available');
      return;
    }

    try {
      setError(null);

      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        return;
      }

      const audioUrl = constructAudioUrl(message.audioFileUrl);
      
      if (process.env.NODE_ENV === 'development') {
        console.log('Playing audio from URL:', audioUrl);
      }

      setIsLoading(true);

      // Test accessibility before attempting playback
      const accessResult = await testAudioFileAccess(audioUrl);
      
      if (!accessResult.success) {
        setIsLoading(false);
        
        if (accessResult.canUseFallback && hasValidTranscription(message.transcription)) {
          setError(`${accessResult.error}. Transcription: "${message.transcription}"`);
        } else {
          setError(accessResult.error || 'Audio file unavailable');
        }
        return;
      }

      // Load audio with robust error handling
      try {
        await loadAudioWithRecovery(audioRef.current, audioUrl);
        
        // Attempt playback
        await audioRef.current.play();
        setIsPlaying(true);
        
      } catch (loadError) {
        console.error('Audio load/play error:', loadError);
        
        if (hasValidTranscription(message.transcription)) {
          setError(`Playback failed. Transcription: "${message.transcription}"`);
        } else {
          setError('Audio playback failed');
        }
      }
      
    } catch (err: any) {
      console.error('Audio playback error:', err);
      
      if (hasValidTranscription(message.transcription)) {
        setError(`Error occurred. Transcription: "${message.transcription}"`);
      } else {
        setError('Audio playback error');
      }
      setIsPlaying(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleLoadError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error('Audio load error:', e);
    setError('Unable to load audio file');
    setIsLoading(false);
  };

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleCanPlayEvent = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !message.audioDuration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * message.audioDuration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progress = message.audioDuration ? (currentTime / message.audioDuration) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Voice Message Player */}
      <Card className={cn(
        "p-4 max-w-sm transition-all duration-200",
        isCurrentUser 
          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-auto" 
          : "bg-gradient-to-br from-amber-100 to-amber-200 text-slate-800"
      )}>
        <div className="flex items-center space-x-3">
          {/* Play/Pause Button - Ocean Blue for Visibility */}
          <Button
            onClick={togglePlayback}
            disabled={isLoading}
            size="sm"
            className={cn(
              "w-12 h-12 rounded-full transition-all duration-200 shadow-lg border-2",
              "bg-gradient-to-br from-[#4FACFE] to-[#3B82F6] hover:from-[#4FACFE]/90 hover:to-[#3B82F6]/90",
              "text-white border-blue-400 hover:shadow-blue-500/25 hover:scale-105",
              "disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            )}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5 ml-0.5" />
            )}
          </Button>

          {/* Waveform / Progress Bar */}
          <div className="flex-1 space-y-2">
            <div className="flex items-center space-x-2 text-xs">
              <Volume2 className="w-3 h-3" />
              <span>{error ? "Audio Error" : "Voice Message"}</span>
            </div>
            
            {/* Progress Bar */}
            <div 
              className="h-2 bg-black/20 rounded-full cursor-pointer"
              onClick={handleSeek}
            >
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-100",
                  isCurrentUser ? "bg-white/80" : "bg-amber-600"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="flex justify-between text-xs opacity-75">
              <span>{formatDuration(currentTime)}</span>
              <span>{formatDuration(message.audioDuration || 0)}</span>
            </div>
          </div>
        </div>

        {/* Audio Element with Centralized URL Construction */}
        <audio
          ref={audioRef}
          src={constructAudioUrl(message.audioFileUrl)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onError={handleLoadError}
          onLoadStart={handleLoadStart}
          onCanPlay={handleCanPlayEvent}
          preload="metadata"
          crossOrigin="anonymous"
          // Enhanced CSP compatibility for S3 audio files
          controlsList="nodownload"
          disablePictureInPicture
        />
        
        {/* Debug Info - Show only in development */}
        {process.env.NODE_ENV === 'development' && error && (
          <div className="text-xs text-gray-500 mt-2 p-2 bg-gray-100 rounded">
            <div>Original Audio URL: {message.audioFileUrl}</div>
            <div>Computed Audio URL: {constructAudioUrl(message.audioFileUrl)}</div>
            <div>Duration: {message.audioDuration}s</div>
            <div>Error: {error}</div>
            <div>Audio Ready State: {audioRef.current?.readyState}</div>
            <div>Audio Network State: {audioRef.current?.networkState}</div>
          </div>
        )}
      </Card>

      {/* Transcription */}
      <Card className={cn(
        "p-4 max-w-lg transition-all duration-200",
        isCurrentUser 
          ? "bg-gradient-to-br from-slate-100 to-slate-200 ml-auto" 
          : "bg-gradient-to-br from-white to-slate-50"
      )}>
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Transcription
          </div>
          <div className="text-slate-700 leading-relaxed">
            {message.transcription || message.content}
          </div>
        </div>
      </Card>
    </div>
  );
}