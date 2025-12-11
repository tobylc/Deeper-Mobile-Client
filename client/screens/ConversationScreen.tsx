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
import { Message, Conversation } from "@/types/api";
import { QuestionSuggestions } from "@/components/QuestionSuggestions";
import { VoiceMessageDisplay } from "@/components/VoiceRecorder";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Conversation">;
  route: RouteProp<AppStackParamList, "Conversation">;
};

export default function ConversationScreen({ navigation, route }: Props) {
  const { conversationId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const flatListRef = useRef<FlatList>(null);
  
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    fetchConversation();
    fetchMessages();
  }, [conversationId]);

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

  const getNextMessageType = (): "question" | "response" => {
    if (messages.length === 0) return "question";
    const lastMessage = messages[messages.length - 1];
    return lastMessage.type === "question" ? "response" : "question";
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

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isFromMe = item.senderEmail === user?.email;
    const showDateHeader =
      index === 0 ||
      formatMessageDate(item.createdAt) !==
        formatMessageDate(messages[index - 1].createdAt);

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
              isFromMe
                ? [styles.messageBubbleRight, { backgroundColor: theme.primary }]
                : [styles.messageBubbleLeft, { backgroundColor: theme.backgroundSecondary }],
            ]}
          >
            <View style={styles.messageTypeLabel}>
              <Feather
                name={item.type === "question" ? "help-circle" : "message-circle"}
                size={12}
                color={isFromMe ? "rgba(255,255,255,0.7)" : theme.textSecondary}
              />
              <ThemedText
                type="small"
                style={{
                  color: isFromMe ? "rgba(255,255,255,0.7)" : theme.textSecondary,
                  marginLeft: Spacing.xs,
                  textTransform: "capitalize",
                }}
              >
                {item.type}
              </ThemedText>
            </View>
            
            {item.messageFormat === "voice" && item.audioUrl ? (
              <VoiceMessageDisplay
                audioUrl={item.audioUrl}
                transcription={item.transcription}
                isFromMe={isFromMe}
              />
            ) : (
              <ThemedText
                type="body"
                style={{ color: isFromMe ? "#fff" : theme.text }}
              >
                {item.content}
              </ThemedText>
            )}
            
            <ThemedText
              type="small"
              style={{
                color: isFromMe ? "rgba(255,255,255,0.6)" : theme.textSecondary,
                alignSelf: "flex-end",
                marginTop: Spacing.xs,
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

        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[
            styles.messageList,
            { paddingTop: Spacing.md, paddingBottom: Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
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
  messageList: {
    paddingHorizontal: Spacing.lg,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
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
    marginVertical: Spacing.xs,
  },
  messageContainerLeft: {
    alignItems: "flex-start",
  },
  messageContainerRight: {
    alignItems: "flex-end",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
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
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
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
