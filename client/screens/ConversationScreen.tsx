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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import { Message, Conversation } from "@/types/api";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Conversation">;
  route: RouteProp<AppStackParamList, "Conversation">;
};

interface QuestionSuggestion {
  id: number;
  text: string;
  category: string;
}

const QUESTION_SUGGESTIONS: QuestionSuggestion[] = [
  { id: 1, text: "What's something you've never told me before?", category: "Deep" },
  { id: 2, text: "What's your happiest memory of us together?", category: "Memory" },
  { id: 3, text: "What do you wish I understood better about you?", category: "Understanding" },
  { id: 4, text: "What's something you'd like us to do together?", category: "Future" },
  { id: 5, text: "What makes you feel most loved?", category: "Love" },
  { id: 6, text: "What's been on your mind lately?", category: "Current" },
];

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
    } catch (error) {
      console.error("Error fetching conversation:", error);
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
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

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
      Alert.alert("Error", "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleSelectSuggestion = (suggestion: QuestionSuggestion) => {
    setMessageText(suggestion.text);
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
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {formatMessageDate(item.createdAt)}
            </ThemedText>
          </View>
        )}
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
            <ThemedText
              type="body"
              style={{ color: isFromMe ? "#fff" : theme.text }}
            >
              {item.content}
            </ThemedText>
            {item.messageFormat === "voice" && item.transcription && (
              <View style={[styles.transcription, { borderTopColor: isFromMe ? "rgba(255,255,255,0.2)" : theme.border }]}>
                <Feather
                  name="mic"
                  size={12}
                  color={isFromMe ? "rgba(255,255,255,0.7)" : theme.textSecondary}
                />
                <ThemedText
                  type="small"
                  style={{
                    color: isFromMe ? "rgba(255,255,255,0.7)" : theme.textSecondary,
                    marginLeft: Spacing.xs,
                    fontStyle: "italic",
                  }}
                >
                  {item.transcription}
                </ThemedText>
              </View>
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

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        {!isMyTurn && conversation && (
          <View style={[styles.turnBanner, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="clock" size={16} color={theme.textSecondary} />
            <ThemedText type="small" style={{ color: theme.textSecondary, marginLeft: Spacing.sm }}>
              Waiting for their response...
            </ThemedText>
          </View>
        )}

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

        {showSuggestions && isMyTurn && (
          <View style={[styles.suggestionsContainer, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.suggestionsHeader}>
              <ThemedText type="h4">Question Ideas</ThemedText>
              <Pressable onPress={() => setShowSuggestions(false)}>
                <Feather name="x" size={20} color={theme.textSecondary} />
              </Pressable>
            </View>
            {QUESTION_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion.id}
                style={[styles.suggestionItem, { backgroundColor: theme.backgroundSecondary }]}
                onPress={() => handleSelectSuggestion(suggestion)}
              >
                <ThemedText type="body">{suggestion.text}</ThemedText>
                <View style={[styles.categoryBadge, { backgroundColor: theme.primary + "20" }]}>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {suggestion.category}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </View>
        )}

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
                <Pressable
                  style={[styles.iconButton, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => setShowSuggestions(!showSuggestions)}
                >
                  <Feather name="help-circle" size={20} color={theme.primary} />
                </Pressable>
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
    alignItems: "center",
    marginVertical: Spacing.md,
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
  transcription: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  suggestionsContainer: {
    position: "absolute",
    bottom: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 300,
  },
  suggestionsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  suggestionItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
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
});
