import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Pressable,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import { Message, Conversation, Connection } from "@/types/api";
import { QuestionSuggestions } from "@/components/QuestionSuggestions";
import { VoiceRecorder, VoiceMessageDisplay } from "@/components/VoiceRecorder";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Conversation">;
  route: RouteProp<AppStackParamList, "Conversation">;
};

const THOUGHTFUL_RESPONSE_TIMER = 10 * 60;

export default function ConversationScreen({ navigation, route }: Props) {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [showThoughtfulTimer, setShowThoughtfulTimer] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(THOUGHTFUL_RESPONSE_TIMER);
  const [showExpandedMessages, setShowExpandedMessages] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    fetchConversation();
    fetchMessages();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [conversationId]);

  useEffect(() => {
    if (conversation?.connectionId) {
      fetchConnection();
    }
  }, [conversation?.connectionId]);

  useEffect(() => {
    const nextType = getNextMessageType();
    const isMyTurn = conversation?.currentTurn === user?.email;
    
    if (nextType === "response" && isMyTurn && !showThoughtfulTimer) {
      setShowThoughtfulTimer(true);
      setTimerSeconds(THOUGHTFUL_RESPONSE_TIMER);
      
      timerRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else if (nextType !== "response" || !isMyTurn) {
      setShowThoughtfulTimer(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [conversation?.currentTurn, messages.length]);

  const fetchConversation = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Conversation>(
        `/api/conversations/${conversationId}`,
        { headers: getAuthHeaders(token) }
      );
      setConversation(data);
      navigation.setOptions({
        headerTitle: data.title || "Conversation",
      });
      setFetchError(false);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      setFetchError(true);
    }
  };

  const fetchConnection = async () => {
    if (!token || !conversation?.connectionId) return;
    try {
      const connections = await apiRequest<Connection[]>(
        `/api/connections/${encodeURIComponent(user?.email || "")}`,
        { headers: getAuthHeaders(token) }
      );
      const conn = connections.find((c) => c.id === conversation.connectionId);
      if (conn) setConnection(conn);
    } catch (error) {
      console.log("Could not fetch connection details");
    }
  };

  const fetchMessages = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<Message[]>(
        `/api/conversations/${conversationId}/messages`,
        { headers: getAuthHeaders(token) }
      );
      setMessages(data);
      setFetchError(false);
    } catch (error) {
      console.error("Error fetching messages:", error);
      setFetchError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchConversation(), fetchMessages()]);
    setRefreshing(false);
  }, [conversationId, token]);

  const isMyTurn = conversation?.currentTurn === user?.email;
  const isUserInviter = connection?.inviterEmail === user?.email;

  const getNextMessageType = (): "question" | "response" => {
    if (messages.length === 0) return "question";
    const lastMessage = messages[messages.length - 1];
    return lastMessage.type === "question" ? "response" : "question";
  };

  const getGlowColor = (senderEmail: string) => {
    if (!connection) return theme.border;
    return senderEmail === connection.inviterEmail ? theme.primary : theme.accent;
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !token || !user?.email || !conversation) return;

    setIsSending(true);
    try {
      const newMessage = await apiRequest<Message>(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: getAuthHeaders(token),
          body: JSON.stringify({
            senderEmail: user.email,
            content: messageText.trim(),
            type: getNextMessageType(),
            messageFormat: "text",
          }),
        }
      );
      setMessages((prev) => [...prev, newMessage]);
      setMessageText("");
      setShowSuggestions(false);
      
      await fetchConversation();
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      Alert.alert("Error", "Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handleVoiceRecordingComplete = async (uri: string, duration: number) => {
    if (!token || !user?.email || !conversation) return;
    
    Alert.alert(
      "Voice Message",
      "Voice messages will be transcribed using AI. Would you like to send this recording?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: async () => {
            setIsSending(true);
            try {
              const newMessage = await apiRequest<Message>(
                `/api/conversations/${conversationId}/messages`,
                {
                  method: "POST",
                  headers: getAuthHeaders(token),
                  body: JSON.stringify({
                    senderEmail: user.email,
                    content: "[Voice message]",
                    type: getNextMessageType(),
                    messageFormat: "voice",
                    audioUrl: uri,
                    audioDuration: duration,
                  }),
                }
              );
              setMessages((prev) => [...prev, newMessage]);
              setInputMode("text");
              await fetchConversation();
              
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: true });
              }, 100);
            } catch (error) {
              Alert.alert("Error", "Failed to send voice message.");
            } finally {
              setIsSending(false);
            }
          },
        },
      ]
    );
  };

  const handleSelectQuestion = (question: string) => {
    setMessageText(question);
    setShowSuggestions(false);
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  };

  const formatMessageDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const getVisibleMessages = () => {
    if (showExpandedMessages || messages.length <= 4) return messages;
    return messages.slice(-2);
  };

  const renderStackedPreview = () => {
    if (messages.length <= 4 || showExpandedMessages) return null;
    const hiddenCount = messages.length - 2;
    
    return (
      <Pressable
        style={[styles.stackedPreview, { backgroundColor: theme.backgroundSecondary }]}
        onPress={() => setShowExpandedMessages(true)}
      >
        <View style={styles.stackedCards}>
          {[2, 1, 0].map((offset) => (
            <View
              key={offset}
              style={[
                styles.stackedCard,
                {
                  backgroundColor: theme.backgroundTertiary,
                  bottom: offset * 4,
                  left: offset * 2,
                  right: offset * 2,
                  opacity: 1 - offset * 0.2,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.stackedInfo}>
          <Feather name="layers" size={16} color={theme.textSecondary} />
          <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
            {hiddenCount} earlier message{hiddenCount > 1 ? "s" : ""}
          </ThemedText>
        </View>
        <Feather name="chevron-down" size={20} color={theme.textSecondary} />
      </Pressable>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const visibleMessages = getVisibleMessages();
    const isFromMe = item.senderEmail === user?.email;
    const currentIndex = visibleMessages.indexOf(item);
    const showDateHeader =
      currentIndex === 0 ||
      formatMessageDate(item.createdAt) !==
        formatMessageDate(visibleMessages[currentIndex - 1]?.createdAt || "");

    const glowColor = getGlowColor(item.senderEmail);
    const isInviterMessage = connection?.inviterEmail === item.senderEmail;

    return (
      <View>
        {showDateHeader ? (
          <View style={styles.dateHeader}>
            <View style={[styles.dateHeaderLine, { backgroundColor: theme.border }]} />
            <View style={[styles.dateHeaderBadge, { backgroundColor: theme.backgroundSecondary }]}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                {formatMessageDate(item.createdAt)}
              </ThemedText>
            </View>
            <View style={[styles.dateHeaderLine, { backgroundColor: theme.border }]} />
          </View>
        ) : null}
        <View
          style={[
            styles.messageContainer,
            isFromMe ? styles.messageContainerRight : styles.messageContainerLeft,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              styles.paperTexture,
              isFromMe
                ? [styles.messageBubbleRight, { backgroundColor: theme.backgroundSecondary }]
                : [styles.messageBubbleLeft, { backgroundColor: theme.backgroundSecondary }],
              {
                borderWidth: 2,
                borderColor: glowColor,
                shadowColor: glowColor,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
                elevation: 4,
              },
            ]}
          >
            <View style={[styles.messageTypeLabel, { borderBottomColor: theme.border + "40" }]}>
              <Feather
                name={item.type === "question" ? "help-circle" : "message-circle"}
                size={12}
                color={isInviterMessage ? theme.primary : theme.accent}
              />
              <ThemedText
                type="small"
                style={{
                  color: isInviterMessage ? theme.primary : theme.accent,
                  marginLeft: Spacing.xs,
                  textTransform: "capitalize",
                  fontWeight: "600",
                }}
              >
                {item.type}
              </ThemedText>
              <View style={[styles.roleIndicator, { backgroundColor: isInviterMessage ? theme.primary + "20" : theme.accent + "20" }]}>
                <ThemedText type="small" style={{ color: isInviterMessage ? theme.primary : theme.accent, fontSize: 10 }}>
                  {isInviterMessage ? (connection?.inviterRole || "Inviter") : (connection?.inviteeRole || "Invitee")}
                </ThemedText>
              </View>
            </View>
            
            {item.messageFormat === "voice" && item.audioUrl ? (
              <VoiceMessageDisplay
                audioUrl={item.audioUrl}
                transcription={item.transcription}
                isFromMe={isFromMe}
              />
            ) : (
              <ThemedText type="body" style={{ color: theme.text, lineHeight: 24 }}>
                {item.content}
              </ThemedText>
            )}
            
            <ThemedText
              type="small"
              style={{
                color: theme.textSecondary,
                alignSelf: "flex-end",
                marginTop: Spacing.sm,
                fontSize: 11,
              }}
            >
              {formatMessageTime(item.createdAt)}
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  if (fetchError && messages.length === 0) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <Feather name="alert-circle" size={48} color={theme.error} />
        <ThemedText
          type="body"
          style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}
        >
          Failed to load conversation
        </ThemedText>
        <Pressable
          style={[styles.retryButton, { backgroundColor: theme.primary }]}
          onPress={() => {
            setIsLoading(true);
            fetchConversation();
            fetchMessages();
          }}
        >
          <Feather name="refresh-cw" size={16} color="#fff" />
          <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
            Retry
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {!isMyTurn && conversation ? (
          <View style={[styles.turnBanner, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="clock" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
              Waiting for their response...
            </ThemedText>
          </View>
        ) : null}

        {showExpandedMessages && messages.length > 4 ? (
          <Pressable
            style={[styles.collapseButton, { backgroundColor: theme.backgroundSecondary }]}
            onPress={() => setShowExpandedMessages(false)}
          >
            <Feather name="chevron-up" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
              Show less
            </ThemedText>
          </Pressable>
        ) : null}

        <FlatList
          ref={flatListRef}
          data={getVisibleMessages()}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.messageList,
            { paddingTop: Spacing.md, paddingBottom: Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={renderStackedPreview}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.primary}
              colors={[theme.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}
              >
                Start the conversation with a thoughtful question
              </ThemedText>
            </View>
          }
        />

        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: theme.backgroundDefault,
              paddingBottom: insets.bottom + Spacing.sm,
              borderTopColor: theme.border,
            },
          ]}
        >
          {isMyTurn ? (
            <>
              {showThoughtfulTimer && timerSeconds > 0 ? (
                <View style={[styles.thoughtfulTimer, { backgroundColor: theme.accent + "20" }]}>
                  <Feather name="clock" size={14} color={theme.accent} />
                  <ThemedText type="small" style={{ color: theme.accent, marginLeft: Spacing.xs }}>
                    Take your time to respond thoughtfully: {formatTimer(timerSeconds)}
                  </ThemedText>
                </View>
              ) : null}

              <View style={styles.modeToggle}>
                <Pressable
                  style={[
                    styles.modeButton,
                    { backgroundColor: inputMode === "text" ? theme.primary : theme.backgroundSecondary },
                  ]}
                  onPress={() => setInputMode("text")}
                >
                  <Feather name="type" size={16} color={inputMode === "text" ? "#fff" : theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={{
                      color: inputMode === "text" ? "#fff" : theme.textSecondary,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Text
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.modeButton,
                    { backgroundColor: inputMode === "voice" ? theme.primary : theme.backgroundSecondary },
                  ]}
                  onPress={() => setInputMode("voice")}
                >
                  <Feather name="mic" size={16} color={inputMode === "voice" ? "#fff" : theme.textSecondary} />
                  <ThemedText
                    type="small"
                    style={{
                      color: inputMode === "voice" ? "#fff" : theme.textSecondary,
                      marginLeft: Spacing.xs,
                    }}
                  >
                    Voice
                  </ThemedText>
                </Pressable>
              </View>

              {inputMode === "text" ? (
                <>
                  <View style={styles.inputRow}>
                    {getNextMessageType() === "question" ? (
                      <Pressable
                        style={[styles.iconButton, { backgroundColor: theme.backgroundSecondary }]}
                        onPress={() => setShowSuggestions(true)}
                      >
                        <Feather name="help-circle" size={20} color={theme.primary} />
                      </Pressable>
                    ) : null}
                    <View style={[styles.textInputContainer, { backgroundColor: theme.backgroundSecondary }]}>
                      <TextInput
                        style={[styles.textInput, { color: theme.text }]}
                        placeholder={
                          getNextMessageType() === "question"
                            ? "Ask a thoughtful question..."
                            : "Share your response..."
                        }
                        placeholderTextColor={theme.textSecondary}
                        value={messageText}
                        onChangeText={setMessageText}
                        multiline
                        maxLength={2000}
                      />
                    </View>
                    <Pressable
                      style={[
                        styles.sendButton,
                        {
                          backgroundColor: messageText.trim() ? theme.primary : theme.backgroundSecondary,
                        },
                      ]}
                      onPress={handleSendMessage}
                      disabled={!messageText.trim() || isSending}
                    >
                      {isSending ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Feather
                          name="send"
                          size={20}
                          color={messageText.trim() ? "#fff" : theme.textSecondary}
                        />
                      )}
                    </Pressable>
                  </View>
                </>
              ) : (
                <VoiceRecorder
                  onRecordingComplete={handleVoiceRecordingComplete}
                  onCancel={() => setInputMode("text")}
                  disabled={isSending}
                />
              )}

              <View style={styles.inputHint}>
                <Feather
                  name={getNextMessageType() === "question" ? "help-circle" : "message-circle"}
                  size={12}
                  color={theme.textSecondary}
                />
                <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.xs }}>
                  Your turn to {getNextMessageType() === "question" ? "ask a question" : "respond"}
                </ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.waitingContainer}>
              <Feather name="clock" size={20} color={theme.textSecondary} />
              <ThemedText type="body" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
                Waiting for their turn...
              </ThemedText>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showSuggestions}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSuggestions(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => setShowSuggestions(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}>
            <QuestionSuggestions
              relationshipType={conversation?.relationshipType}
              onSelectQuestion={handleSelectQuestion}
              onClose={() => setShowSuggestions(false)}
            />
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  turnBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  collapseButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  messageList: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  stackedPreview: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  stackedCards: {
    width: 60,
    height: 40,
    position: "relative",
  },
  stackedCard: {
    position: "absolute",
    height: 32,
    borderRadius: BorderRadius.sm,
    left: 0,
    right: 0,
  },
  stackedInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: Spacing.md,
  },
  dateHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.lg,
  },
  dateHeaderLine: {
    flex: 1,
    height: 1,
  },
  dateHeaderBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginHorizontal: Spacing.sm,
  },
  messageContainer: {
    marginVertical: Spacing.sm,
  },
  messageContainerLeft: {
    alignItems: "flex-start",
  },
  messageContainerRight: {
    alignItems: "flex-end",
  },
  messageBubble: {
    maxWidth: "85%",
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
  },
  paperTexture: {
    backgroundColor: "#F5F0E8",
  },
  messageBubbleLeft: {
    borderBottomLeftRadius: BorderRadius.xs,
  },
  messageBubbleRight: {
    borderBottomRightRadius: BorderRadius.xs,
  },
  messageTypeLabel: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
  },
  roleIndicator: {
    marginLeft: "auto",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  inputContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
  },
  thoughtfulTimer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  modeToggle: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  modeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  textInputContainer: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 44,
    maxHeight: 120,
  },
  textInput: {
    fontSize: 16,
    lineHeight: 22,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  inputHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  waitingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "70%",
  },
});
