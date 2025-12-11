import React from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface BasePopupProps {
  visible: boolean;
  onClose: () => void;
}

export function WaitingTurnPopup({ visible, onClose, partnerName = "them" }: BasePopupProps & { partnerName?: string }) {
  const { theme } = useTheme();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.popupCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="clock" size={32} color={theme.primary} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            Waiting for Their Turn
          </ThemedText>
          
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            It's {partnerName}'s turn to respond. Give them time to craft a thoughtful message.
          </ThemedText>
          
          <View style={styles.tipBox}>
            <Feather name="info" size={16} color={theme.accent} />
            <ThemedText type="small" style={[styles.tipText, { color: theme.textSecondary }]}>
              You'll receive a notification when they respond
            </ThemedText>
          </View>
          
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <ThemedText type="body" style={{ color: "#fff" }}>Got It</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface TrialExpirationPopupProps extends BasePopupProps {
  daysRemaining: number;
  onUpgrade: () => void;
}

export function TrialExpirationPopup({ visible, onClose, daysRemaining, onUpgrade }: TrialExpirationPopupProps) {
  const { theme } = useTheme();
  const isExpired = daysRemaining <= 0;
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.popupCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconCircle, { backgroundColor: isExpired ? theme.error + "20" : theme.accent + "20" }]}>
            <Feather 
              name={isExpired ? "alert-circle" : "award"} 
              size={32} 
              color={isExpired ? theme.error : theme.accent} 
            />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            {isExpired ? "Trial Expired" : "Trial Ending Soon"}
          </ThemedText>
          
          {!isExpired ? (
            <View style={[styles.countdownBadge, { backgroundColor: theme.accent + "20" }]}>
              <ThemedText type="h2" style={{ color: theme.accent }}>
                {daysRemaining}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.accent }}>
                days left
              </ThemedText>
            </View>
          ) : null}
          
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            {isExpired 
              ? "Your trial has ended. Upgrade now to continue using all features and maintain your connections."
              : "Your trial is ending soon. Upgrade now to keep all your conversations and unlock unlimited connections."
            }
          </ThemedText>
          
          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>Unlimited conversations</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>Voice message transcription</ThemedText>
            </View>
            <View style={styles.featureItem}>
              <Feather name="check-circle" size={16} color={theme.success} />
              <ThemedText type="small" style={{ marginLeft: Spacing.sm }}>Priority support</ThemedText>
            </View>
          </View>
          
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={onUpgrade}
          >
            <ThemedText type="body" style={{ color: "#fff" }}>Upgrade Now</ThemedText>
          </Pressable>
          
          {!isExpired ? (
            <Pressable onPress={onClose}>
              <ThemedText type="small" style={[styles.skipLink, { color: theme.textSecondary }]}>
                Maybe Later
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function ExchangeRequiredPopup({ visible, onClose }: BasePopupProps) {
  const { theme } = useTheme();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.popupCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accent + "20" }]}>
            <Feather name="repeat" size={32} color={theme.accent} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            Exchange Required
          </ThemedText>
          
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            Deeper conversations work best when both people participate equally. 
            Please wait for a response before asking another question.
          </ThemedText>
          
          <View style={styles.exchangeFlow}>
            <View style={styles.exchangeStep}>
              <View style={[styles.exchangeIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="help-circle" size={20} color={theme.primary} />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Question</ThemedText>
            </View>
            <Feather name="arrow-right" size={20} color={theme.border} />
            <View style={styles.exchangeStep}>
              <View style={[styles.exchangeIcon, { backgroundColor: theme.accent + "20" }]}>
                <Feather name="message-circle" size={20} color={theme.accent} />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Response</ThemedText>
            </View>
            <Feather name="arrow-right" size={20} color={theme.border} />
            <View style={styles.exchangeStep}>
              <View style={[styles.exchangeIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="help-circle" size={20} color={theme.primary} />
              </View>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Question</ThemedText>
            </View>
          </View>
          
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <ThemedText type="body" style={{ color: "#fff" }}>I Understand</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface ThoughtfulResponsePopupProps extends BasePopupProps {
  timeRemaining: number;
}

export function ThoughtfulResponsePopup({ visible, onClose, timeRemaining }: ThoughtfulResponsePopupProps) {
  const { theme } = useTheme();
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.popupCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accent + "20" }]}>
            <Feather name="clock" size={32} color={theme.accent} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            Take Your Time
          </ThemedText>
          
          <View style={[styles.timerDisplay, { backgroundColor: theme.backgroundSecondary }]}>
            <ThemedText type="h1" style={{ color: theme.accent }}>
              {formatTime(timeRemaining)}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              remaining
            </ThemedText>
          </View>
          
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            Meaningful conversations deserve thoughtful responses. Take a moment to reflect before sharing your thoughts.
          </ThemedText>
          
          <View style={styles.tipBox}>
            <Feather name="heart" size={16} color={theme.primary} />
            <ThemedText type="small" style={[styles.tipText, { color: theme.textSecondary }]}>
              Quality over speed builds deeper connections
            </ThemedText>
          </View>
          
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={onClose}
          >
            <ThemedText type="body" style={{ color: "#fff" }}>Continue Writing</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface OnboardingPopupProps extends BasePopupProps {
  step: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
}

export function OnboardingPopup({ visible, onClose, step, totalSteps, onNext, onSkip }: OnboardingPopupProps) {
  const { theme } = useTheme();
  
  const steps = [
    {
      icon: "users" as const,
      title: "Connect with People",
      description: "Invite family, friends, or partners to have meaningful conversations with you.",
    },
    {
      icon: "help-circle" as const,
      title: "Ask Thoughtful Questions",
      description: "Start conversations with carefully crafted questions designed to foster deeper understanding.",
    },
    {
      icon: "message-circle" as const,
      title: "Take Turns",
      description: "Exchange questions and responses in a turn-based format that encourages reflection.",
    },
    {
      icon: "mic" as const,
      title: "Voice or Text",
      description: "Share your thoughts through text or voice messages - whatever feels most natural.",
    },
  ];
  
  const currentStep = steps[step - 1] || steps[0];
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.popupCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primary + "20" }]}>
            <Feather name={currentStep.icon} size={32} color={theme.primary} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            {currentStep.title}
          </ThemedText>
          
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            {currentStep.description}
          </ThemedText>
          
          <View style={styles.stepIndicators}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.stepDot,
                  {
                    backgroundColor: i + 1 <= step ? theme.primary : theme.border,
                  },
                ]}
              />
            ))}
          </View>
          
          <View style={styles.onboardingActions}>
            {step < totalSteps ? (
              <>
                <Pressable onPress={onSkip}>
                  <ThemedText type="body" style={{ color: theme.textSecondary }}>
                    Skip
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.button, styles.onboardingButton, { backgroundColor: theme.primary }]}
                  onPress={onNext}
                >
                  <ThemedText type="body" style={{ color: "#fff" }}>Next</ThemedText>
                </Pressable>
              </>
            ) : (
              <Pressable
                style={[styles.button, { backgroundColor: theme.primary, flex: 1 }]}
                onPress={onClose}
              >
                <ThemedText type="body" style={{ color: "#fff" }}>Get Started</ThemedText>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ConnectionLimitPopup({ visible, onClose, limit, onUpgrade }: BasePopupProps & { limit: number; onUpgrade: () => void }) {
  const { theme } = useTheme();
  
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.popupCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.accent + "20" }]}>
            <Feather name="users" size={32} color={theme.accent} />
          </View>
          
          <ThemedText type="h3" style={styles.title}>
            Connection Limit Reached
          </ThemedText>
          
          <ThemedText type="body" style={[styles.description, { color: theme.textSecondary }]}>
            You've reached your limit of {limit} connection{limit > 1 ? "s" : ""}. 
            Upgrade your plan to connect with more people.
          </ThemedText>
          
          <View style={styles.planComparison}>
            <View style={[styles.planItem, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Basic</ThemedText>
              <ThemedText type="h4">1 Connection</ThemedText>
            </View>
            <View style={[styles.planItem, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Advanced</ThemedText>
              <ThemedText type="h4">3 Connections</ThemedText>
            </View>
            <View style={[styles.planItem, styles.planItemHighlight, { borderColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: theme.primary }}>Unlimited</ThemedText>
              <ThemedText type="h4" style={{ color: theme.primary }}>No Limits</ThemedText>
            </View>
          </View>
          
          <Pressable
            style={[styles.button, { backgroundColor: theme.primary }]}
            onPress={onUpgrade}
          >
            <ThemedText type="body" style={{ color: "#fff" }}>Upgrade Now</ThemedText>
          </Pressable>
          
          <Pressable onPress={onClose}>
            <ThemedText type="small" style={[styles.skipLink, { color: theme.textSecondary }]}>
              Maybe Later
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  popupCard: {
    width: "100%",
    maxWidth: 340,
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    alignItems: "center",
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  tipBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  tipText: {
    marginLeft: Spacing.sm,
    flex: 1,
  },
  button: {
    width: "100%",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  skipLink: {
    marginTop: Spacing.md,
  },
  countdownBadge: {
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  featureList: {
    width: "100%",
    marginBottom: Spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  exchangeFlow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  exchangeStep: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  exchangeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  timerDisplay: {
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  stepIndicators: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  onboardingActions: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  onboardingButton: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  planComparison: {
    width: "100%",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  planItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  planItemHighlight: {
    borderWidth: 2,
  },
});
