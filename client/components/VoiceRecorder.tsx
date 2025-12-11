import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
} from "expo-audio";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface VoiceRecorderProps {
  onRecordingComplete: (uri: string, duration: number) => void;
  onCancel: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, disabled }: VoiceRecorderProps) {
  const { theme } = useTheme();
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const pulseScale = useSharedValue(1);
  const volumeLevel = useSharedValue(0.3);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 100);

  useEffect(() => {
    requestPermissions();
    
    return () => {
      if (audioRecorder) {
        try {
          audioRecorder.stop();
        } catch (e) {}
      }
    };
  }, []);

  useEffect(() => {
    if (recorderState.isRecording && !isPaused) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
      
      volumeLevel.value = withRepeat(
        withSequence(
          withSpring(0.6),
          withSpring(0.4),
          withSpring(0.8),
          withSpring(0.3),
          withSpring(0.7),
          withSpring(0.5),
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(volumeLevel);
      pulseScale.value = withTiming(1, { duration: 200 });
      volumeLevel.value = withTiming(0.3, { duration: 200 });
    }
    
    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(volumeLevel);
    };
  }, [recorderState.isRecording, isPaused]);

  const requestPermissions = async () => {
    if (Platform.OS === "web") {
      setPermissionGranted(false);
      return;
    }
    
    try {
      const status = await AudioModule.requestRecordingPermissionsAsync();
      setPermissionGranted(status.granted);
      
      if (status.granted) {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      }
    } catch (error) {
      console.error("Error checking audio permissions:", error);
      setPermissionGranted(false);
    }
  };

  const pulseAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const createVolumeBarStyle = (index: number) => {
    return useAnimatedStyle(() => {
      const heights = [0.4, 0.7, 1, 0.6, 0.8, 0.5, 0.9, 0.3];
      const baseHeight = heights[index % heights.length];
      return {
        height: `${baseHeight * volumeLevel.value * 100}%`,
      };
    });
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "Voice recording is available in Expo Go. Please scan the QR code with your phone to use this feature."
      );
      return;
    }

    try {
      if (!permissionGranted) {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        if (!status.granted) {
          Alert.alert(
            "Permission Required",
            "Microphone permission is needed to record voice messages."
          );
          return;
        }
        setPermissionGranted(true);
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
        });
      }

      setShowPreview(false);
      setRecordedUri(null);
      setIsPaused(false);
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const pauseRecording = async () => {
    if (!recorderState.isRecording) return;
    
    try {
      await audioRecorder.pause();
      setIsPaused(true);
    } catch (error) {
      console.error("Failed to pause recording:", error);
    }
  };

  const resumeRecording = async () => {
    if (!isPaused) return;
    
    try {
      audioRecorder.record();
      setIsPaused(false);
    } catch (error) {
      console.error("Failed to resume recording:", error);
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording && !isPaused) return;

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const duration = Math.floor(recorderState.durationMillis / 1000);
      
      if (uri) {
        setRecordedUri(uri);
        setRecordedDuration(duration);
        setShowPreview(true);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to save recording");
    }
  };

  const confirmRecording = () => {
    if (recordedUri) {
      onRecordingComplete(recordedUri, recordedDuration);
      setShowPreview(false);
      setRecordedUri(null);
    }
  };

  const discardRecording = () => {
    setShowPreview(false);
    setRecordedUri(null);
    setRecordedDuration(0);
  };

  const cancelRecording = async () => {
    if (recorderState.isRecording || isPaused) {
      try {
        await audioRecorder.stop();
      } catch (e) {}
    }
    setShowPreview(false);
    setRecordedUri(null);
    setIsPaused(false);
    onCancel();
  };
  
  useEffect(() => {
    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(volumeLevel);
    };
  }, []);

  if (Platform.OS === "web") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
        <Feather name="mic-off" size={24} color={theme.textSecondary} />
        <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
          Voice recording available in Expo Go
        </ThemedText>
      </View>
    );
  }

  if (showPreview && recordedUri) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
        <View style={styles.previewContainer}>
          <View style={styles.previewInfo}>
            <View style={[styles.previewIcon, { backgroundColor: theme.primary + "20" }]}>
              <Feather name="mic" size={20} color={theme.primary} />
            </View>
            <View style={styles.previewText}>
              <ThemedText type="body" style={{ fontWeight: "600" }}>
                Voice Message Ready
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Duration: {formatDuration(recordedDuration * 1000)}
              </ThemedText>
            </View>
          </View>
          
          <View style={styles.previewActions}>
            <Pressable
              style={[styles.previewButton, { backgroundColor: theme.error + "20" }]}
              onPress={discardRecording}
            >
              <Feather name="trash-2" size={18} color={theme.error} />
            </Pressable>
            <Pressable
              style={[styles.previewButton, { backgroundColor: theme.backgroundTertiary }]}
              onPress={startRecording}
            >
              <Feather name="refresh-cw" size={18} color={theme.textSecondary} />
            </Pressable>
            <Pressable
              style={[styles.sendPreviewButton, { backgroundColor: theme.primary }]}
              onPress={confirmRecording}
            >
              <Feather name="send" size={18} color="#fff" />
              <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
                Send
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      {recorderState.isRecording || isPaused ? (
        <View style={styles.recordingContainer}>
          <Pressable style={styles.cancelButton} onPress={cancelRecording}>
            <Feather name="x" size={20} color={theme.error} />
          </Pressable>

          <View style={styles.recordingInfo}>
            <Animated.View style={[styles.recordingDot, { backgroundColor: isPaused ? theme.warning : theme.error }, pulseAnimatedStyle]} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {formatDuration(recorderState.durationMillis)}
            </ThemedText>
          </View>

          <View style={styles.volumeBars}>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <Animated.View
                key={i}
                style={[
                  styles.volumeBar,
                  { backgroundColor: theme.primary },
                  createVolumeBarStyle(i),
                ]}
              />
            ))}
          </View>

          <View style={styles.recordingControls}>
            {isPaused ? (
              <Pressable
                style={[styles.controlButton, { backgroundColor: theme.primary }]}
                onPress={resumeRecording}
              >
                <Feather name="play" size={18} color="#fff" />
              </Pressable>
            ) : (
              <Pressable
                style={[styles.controlButton, { backgroundColor: theme.warning }]}
                onPress={pauseRecording}
              >
                <Feather name="pause" size={18} color="#fff" />
              </Pressable>
            )}
            
            <Pressable
              style={[styles.stopButton, { backgroundColor: theme.error }]}
              onPress={stopRecording}
            >
              <Feather name="square" size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          style={[styles.recordButton, { backgroundColor: theme.primary }]}
          onPress={startRecording}
          disabled={disabled}
        >
          <Feather name="mic" size={20} color="#fff" />
          <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
            Record Voice Message
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

interface VoiceMessageDisplayProps {
  audioUrl: string;
  transcription: string | null;
  duration?: number;
  isFromMe?: boolean;
}

export function VoiceMessageDisplay({ audioUrl, transcription, duration = 0, isFromMe }: VoiceMessageDisplayProps) {
  const { theme } = useTheme();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const player = useAudioPlayer(audioUrl);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (player) {
        player.pause();
      }
    };
  }, []);

  const handlePlayPause = async () => {
    if (Platform.OS === "web") {
      Alert.alert(
        "Not Available",
        "Voice playback is available in Expo Go. Please scan the QR code with your phone."
      );
      return;
    }

    try {
      if (isPlaying) {
        player.pause();
        setIsPlaying(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      player.play();
      setIsPlaying(true);
      
      intervalRef.current = setInterval(() => {
        if (player.playing) {
          const pos = player.currentTime;
          const totalDuration = player.duration || duration;
          setCurrentTime(pos);
          setProgress(totalDuration > 0 ? (pos / totalDuration) * 100 : 0);
        } else if (!player.playing && isPlaying) {
          setIsPlaying(false);
          setProgress(0);
          setCurrentTime(0);
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        }
      }, 100);
    } catch (error) {
      console.error("Error playing audio:", error);
      Alert.alert("Error", "Failed to play audio");
    }
  };

  const formatDurationDisplay = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const accentColor = isFromMe ? theme.primary : theme.accent;

  return (
    <View style={styles.voiceMessageContainer}>
      <View style={styles.voicePlaybackRow}>
        <Pressable
          style={[
            styles.playButton,
            { backgroundColor: accentColor + "20" },
          ]}
          onPress={handlePlayPause}
        >
          <Feather
            name={isPlaying ? "pause" : "play"}
            size={16}
            color={accentColor}
          />
        </Pressable>

        <View style={styles.waveformContainer}>
          <View style={[styles.waveformBars]}>
            {[0.4, 0.7, 1, 0.6, 0.8, 0.5, 0.9, 0.3, 0.6, 0.8, 0.4, 0.7].map((height, i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: `${height * 100}%`,
                    backgroundColor: i / 12 * 100 < progress ? accentColor : (accentColor + "40"),
                  },
                ]}
              />
            ))}
          </View>
          <ThemedText
            type="small"
            style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}
          >
            {isPlaying ? formatDurationDisplay(currentTime) : formatDurationDisplay(duration)}
          </ThemedText>
        </View>
      </View>

      {transcription ? (
        <View
          style={[
            styles.transcriptionContainer,
            { borderTopColor: theme.border },
          ]}
        >
          <Feather
            name="file-text"
            size={12}
            color={theme.textSecondary}
          />
          <ThemedText
            type="small"
            style={{
              color: theme.textSecondary,
              marginLeft: Spacing.xs,
              fontStyle: "italic",
              flex: 1,
            }}
          >
            {transcription}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  recordingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  volumeBars: {
    flexDirection: "row",
    alignItems: "center",
    height: 32,
    gap: 2,
  },
  volumeBar: {
    width: 3,
    borderRadius: 2,
    minHeight: 4,
  },
  recordingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  previewContainer: {
    gap: Spacing.md,
  },
  previewInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  previewText: {
    marginLeft: Spacing.md,
  },
  previewActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  previewButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendPreviewButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  voiceMessageContainer: {
    gap: Spacing.sm,
  },
  voicePlaybackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  waveformBars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 24,
    gap: 2,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 1,
  },
  transcriptionContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
