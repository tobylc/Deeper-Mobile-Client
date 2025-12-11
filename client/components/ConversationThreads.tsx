import React from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { Conversation } from "@/types/api";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface ConversationThreadsProps {
  visible: boolean;
  conversations: Conversation[];
  currentConversationId: number;
  userEmail: string;
  partnerName: string;
  isLoading?: boolean;
  onSelectThread: (conversationId: number) => void;
  onClose: () => void;
  onCreateThread?: () => void;
}

interface StackedCardProps {
  conversation: Conversation;
  index: number;
  isSelected: boolean;
  userEmail: string;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

function StackedCard({ conversation, index, isSelected, userEmail, onPress, theme }: StackedCardProps) {
  const scale = useSharedValue(1);
  const offsetY = useSharedValue(index * 4);
  
  const getTurnStatus = () => {
    const isMyTurn = conversation.currentTurn === userEmail;
    return {
      isMyTurn,
      label: isMyTurn ? "Your turn" : "Their turn",
    };
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: offsetY.value },
    ],
    zIndex: 100 - index,
  }));

  const turnStatus = getTurnStatus();

  return (
    <AnimatedPressable
      entering={FadeIn.delay(index * 50)}
      style={[
        styles.stackedCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: isSelected ? theme.primary : theme.border,
          borderWidth: isSelected ? 2 : 1,
        },
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.98);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
    >
      <View style={styles.cardStackLayers}>
        <View
          style={[
            styles.stackLayer,
            styles.stackLayer1,
            { backgroundColor: theme.backgroundTertiary, borderColor: theme.border },
          ]}
        />
        <View
          style={[
            styles.stackLayer,
            styles.stackLayer2,
            { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
          ]}
        />
      </View>
      
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <ThemedText type="h4" numberOfLines={1} style={styles.cardTitle}>
            {conversation.title || `Thread #${conversation.id}`}
          </ThemedText>
          {isSelected ? (
            <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
              <ThemedText type="small" style={{ color: "#fff" }}>
                Current
              </ThemedText>
            </View>
          ) : null}
        </View>
        
        <View style={styles.cardMeta}>
          <View
            style={[
              styles.turnBadge,
              {
                backgroundColor: turnStatus.isMyTurn
                  ? theme.primary + "20"
                  : theme.backgroundTertiary,
              },
            ]}
          >
            <View
              style={[
                styles.turnDot,
                {
                  backgroundColor: turnStatus.isMyTurn
                    ? theme.primary
                    : theme.textSecondary,
                },
              ]}
            />
            <ThemedText
              type="small"
              style={{
                color: turnStatus.isMyTurn ? theme.primary : theme.textSecondary,
              }}
            >
              {turnStatus.label}
            </ThemedText>
          </View>
          
          <ThemedText type="small" style={{ color: theme.textSecondary }}>
            {formatDate(conversation.lastActivityAt)}
          </ThemedText>
        </View>
        
        <View
          style={[
            styles.statusIndicator,
            {
              backgroundColor:
                conversation.status === "active"
                  ? theme.success
                  : theme.textSecondary,
            },
          ]}
        />
      </View>
      
      <Feather
        name="chevron-right"
        size={18}
        color={theme.textSecondary}
        style={styles.chevron}
      />
    </AnimatedPressable>
  );
}

export function ConversationThreads({
  visible,
  conversations,
  currentConversationId,
  userEmail,
  partnerName,
  isLoading,
  onSelectThread,
  onClose,
  onCreateThread,
}: ConversationThreadsProps) {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();

  const activeConversations = conversations.filter((c) => c.status === "active");
  const archivedConversations = conversations.filter((c) => c.status !== "active");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Animated.View
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(200)}
            style={styles.backdropInner}
          >
            <BlurView
              intensity={20}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </Pressable>

        <Animated.View
          entering={SlideInRight.springify().damping(20)}
          exiting={SlideOutRight.springify().damping(20)}
          style={[
            styles.panel,
            {
              backgroundColor: theme.backgroundDefault,
              paddingTop: insets.top + Spacing.md,
              paddingBottom: insets.bottom + Spacing.md,
            },
          ]}
        >
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <ThemedText type="h3">Previous Threads</ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                with {partnerName}
              </ThemedText>
            </View>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { backgroundColor: theme.backgroundTertiary, opacity: pressed ? 0.7 : 1 },
              ]}
              hitSlop={8}
            >
              <Feather name="x" size={20} color={theme.text} />
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.threadsList}
              contentContainerStyle={styles.threadsContent}
              showsVerticalScrollIndicator={false}
            >
              {activeConversations.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText
                    type="small"
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    ACTIVE ({activeConversations.length})
                  </ThemedText>
                  {activeConversations.map((conversation, index) => (
                    <StackedCard
                      key={conversation.id}
                      conversation={conversation}
                      index={index}
                      isSelected={conversation.id === currentConversationId}
                      userEmail={userEmail}
                      onPress={() => onSelectThread(conversation.id)}
                      theme={theme}
                    />
                  ))}
                </View>
              ) : null}

              {archivedConversations.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText
                    type="small"
                    style={[styles.sectionLabel, { color: theme.textSecondary }]}
                  >
                    ARCHIVED ({archivedConversations.length})
                  </ThemedText>
                  {archivedConversations.map((conversation, index) => (
                    <StackedCard
                      key={conversation.id}
                      conversation={conversation}
                      index={index}
                      isSelected={conversation.id === currentConversationId}
                      userEmail={userEmail}
                      onPress={() => onSelectThread(conversation.id)}
                      theme={theme}
                    />
                  ))}
                </View>
              ) : null}

              {conversations.length === 0 ? (
                <View style={styles.emptyState}>
                  <Feather
                    name="message-circle"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <ThemedText
                    type="body"
                    style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}
                  >
                    No previous conversations
                  </ThemedText>
                </View>
              ) : null}
            </ScrollView>
          )}

          {onCreateThread ? (
            <View style={styles.panelFooter}>
              <Pressable
                onPress={onCreateThread}
                style={({ pressed }) => [
                  styles.newThreadButton,
                  { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Feather name="plus" size={20} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", fontWeight: "600" }}>
                  Start New Thread
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    flexDirection: "row",
  },
  backdrop: {
    flex: 1,
  },
  backdropInner: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  panel: {
    width: 320,
    maxWidth: "85%",
    shadowColor: "#000",
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  panelTitleRow: {
    flex: 1,
    marginRight: Spacing.md,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  threadsList: {
    flex: 1,
  },
  threadsContent: {
    padding: Spacing.lg,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionLabel: {
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: Spacing.xs,
  },
  stackedCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
    overflow: "visible",
  },
  cardStackLayers: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  stackLayer: {
    position: "absolute",
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  stackLayer1: {
    top: -8,
    left: 4,
    right: 4,
    bottom: 8,
    opacity: 0.5,
  },
  stackLayer2: {
    top: -4,
    left: 2,
    right: 2,
    bottom: 4,
    opacity: 0.75,
  },
  cardContent: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  cardTitle: {
    flex: 1,
  },
  selectedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  cardMeta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  turnBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  turnDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusIndicator: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#fff",
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  panelFooter: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  newThreadButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
});
