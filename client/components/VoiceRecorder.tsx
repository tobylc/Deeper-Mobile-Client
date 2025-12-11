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
  const pulseScale = useSharedValue(1);

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(audioRecorder, 500);

  useEffect(() => {
    requestPermissions();
  }, []);

  useEffect(() => {
    if (recorderState.isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [recorderState.isRecording]);

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

      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
    } catch (error) {
      console.error("Failed to start recording:", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) {
      return;
    }

    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;
      const duration = Math.floor(recorderState.durationMillis / 1000);
      
      if (uri) {
        onRecordingComplete(uri, duration);
      }
    } catch (error) {
      console.error("Failed to stop recording:", error);
      Alert.alert("Error", "Failed to save recording");
    }
  };

  const cancelRecording = async () => {
    if (recorderState.isRecording) {
      try {
        await audioRecorder.stop();
      } catch (e) {}
    }
    onCancel();
  };

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

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundSecondary }]}>
      {recorderState.isRecording ? (
        <View style={styles.recordingContainer}>
          <Pressable style={styles.cancelButton} onPress={cancelRecording}>
            <Feather name="x" size={20} color={theme.error} />
          </Pressable>

          <View style={styles.recordingInfo}>
            <Animated.View style={[styles.recordingDot, { backgroundColor: theme.error }, pulseAnimatedStyle]} />
            <ThemedText type="h4" style={{ marginLeft: Spacing.sm }}>
              {formatDuration(recorderState.durationMillis)}
            </ThemedText>
          </View>

          <Pressable
            style={[styles.stopButton, { backgroundColor: theme.error }]}
            onPress={stopRecording}
          >
            <Feather name="square" size={16} color="#fff" />
          </Pressable>
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

  return (
    <View style={styles.voiceMessageContainer}>
      <View style={styles.voicePlaybackRow}>
        <Pressable
          style={[
            styles.playButton,
            { backgroundColor: isFromMe ? "rgba(255,255,255,0.2)" : theme.primary + "20" },
          ]}
          onPress={handlePlayPause}
        >
          <Feather
            name={isPlaying ? "pause" : "play"}
            size={16}
            color={isFromMe ? "#fff" : theme.primary}
          />
        </Pressable>

        <View style={styles.waveformContainer}>
          <View style={[styles.progressBar, { backgroundColor: isFromMe ? "rgba(255,255,255,0.2)" : theme.backgroundTertiary }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                  backgroundColor: isFromMe ? "#fff" : theme.primary,
                },
              ]}
            />
          </View>
          <ThemedText
            type="small"
            style={{ color: isFromMe ? "rgba(255,255,255,0.7)" : theme.textSecondary }}
          >
            {isPlaying ? formatDurationDisplay(currentTime) : formatDurationDisplay(duration)}
          </ThemedText>
        </View>
      </View>

      {transcription ? (
        <View
          style={[
            styles.transcriptionContainer,
            { borderTopColor: isFromMe ? "rgba(255,255,255,0.2)" : theme.border },
          ]}
        >
          <Feather
            name="file-text"
            size={12}
            color={isFromMe ? "rgba(255,255,255,0.7)" : theme.textSecondary}
          />
          <ThemedText
            type="small"
            style={{
              color: isFromMe ? "rgba(255,255,255,0.8)" : theme.textSecondary,
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
  voiceMessageContainer: {
    gap: Spacing.sm,
  },
  voicePlaybackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  waveformContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  transcriptionContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
