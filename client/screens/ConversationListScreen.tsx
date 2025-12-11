import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import { Conversation, Connection, getRelationshipDisplay } from "@/types/api";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "ConversationList">;
  route: RouteProp<AppStackParamList, "ConversationList">;
};

export default function ConversationListScreen({ navigation, route }: Props) {
  const { connectionId } = route.params;
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);

  React.useEffect(() => {
    fetchData();
  }, [connectionId]);

  const fetchData = async () => {
    if (!user?.email || !token) return;

    try {
      const [convos, conn] = await Promise.all([
        apiRequest<Conversation[]>(
          `/api/conversations/connection/${connectionId}`,
          { headers: getAuthHeaders(token) }
        ),
        apiRequest<Connection>(
          `/api/connections/by-id/${connectionId}`,
          { headers: getAuthHeaders(token) }
        ),
      ]);
      setConversations(convos);
      setConnection(conn);
    } catch (error) {
      console.error("Error fetching conversations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [connectionId]);

  const handleCreateConversation = async () => {
    if (!token || !user?.email || !connection) return;

    setCreating(true);
    try {
      const otherEmail = connection.inviterEmail === user.email
        ? connection.inviteeEmail
        : connection.inviterEmail;

      const newConversation = await apiRequest<Conversation>(
        "/api/conversations",
        {
          method: "POST",
          headers: getAuthHeaders(token),
          body: JSON.stringify({
            connectionId,
            participant1Email: user.email,
            participant2Email: otherEmail,
            relationshipType: connection.relationshipType,
          }),
        }
      );
      navigation.navigate("Conversation", { conversationId: newConversation.id });
    } catch (error) {
      Alert.alert("Error", "Failed to create conversation");
    } finally {
      setCreating(false);
    }
  };

  const getOtherPersonEmail = () => {
    if (!connection || !user?.email) return "";
    return connection.inviterEmail === user.email
      ? connection.inviteeEmail
      : connection.inviterEmail;
  };

  const getTurnStatus = (conversation: Conversation) => {
    if (!user?.email) return { isMyTurn: false, label: "" };
    const isMyTurn = conversation.currentTurn === user.email;
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

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const otherPerson = getOtherPersonEmail().split("@")[0];

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
      >
        {connection && (
          <Card elevation={1} style={styles.connectionHeader}>
            <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
              <ThemedText type="h2" style={{ color: "#fff" }}>
                {otherPerson.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <ThemedText type="h3" style={styles.connectionName}>
              {otherPerson}
            </ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {getRelationshipDisplay(
                connection.relationshipType,
                connection.inviterRole,
                connection.inviteeRole
              )}
            </ThemedText>
          </Card>
        )}

        <View style={styles.conversationsSection}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4">Conversations</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary }}>
              {conversations?.length ?? 0} thread{(conversations?.length ?? 0) !== 1 ? "s" : ""}
            </ThemedText>
          </View>

          {!conversations || conversations.length === 0 ? (
            <Card elevation={1} style={styles.emptyCard}>
              <Feather name="message-circle" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}
              >
                No conversations yet.{"\n"}Start your first meaningful exchange.
              </ThemedText>
              <Button
                title="Start Conversation"
                onPress={handleCreateConversation}
                loading={creating}
                style={{ marginTop: Spacing.lg }}
              />
            </Card>
          ) : (
            <>
              {conversations?.map?.((conversation) => {
                const turnStatus = getTurnStatus(conversation);
                return (
                  <Pressable
                    key={conversation.id}
                    onPress={() => navigation.navigate("Conversation", { conversationId: conversation.id })}
                  >
                    <Card elevation={1} style={styles.conversationCard}>
                      <View style={styles.conversationContent}>
                        <View style={styles.conversationHeader}>
                          <ThemedText type="h4" numberOfLines={1} style={styles.conversationTitle}>
                            {conversation.title || `Thread #${conversation.id}`}
                          </ThemedText>
                          <ThemedText type="small" style={{ color: theme.textSecondary }}>
                            {formatDate(conversation.lastActivityAt)}
                          </ThemedText>
                        </View>
                        <View style={styles.conversationMeta}>
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
                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor:
                                  conversation.status === "active"
                                    ? theme.success + "20"
                                    : theme.backgroundTertiary,
                              },
                            ]}
                          >
                            <ThemedText
                              type="small"
                              style={{
                                color:
                                  conversation.status === "active"
                                    ? theme.success
                                    : theme.textSecondary,
                              }}
                            >
                              {conversation.status}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                      <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                    </Card>
                  </Pressable>
                );
              })}
            </>
          )}
        </View>
      </ScrollView>

      {conversations.length > 0 && (
        <View style={[styles.fabContainer, { bottom: insets.bottom + Spacing.lg }]}>
          <Pressable
            style={[styles.fab, { backgroundColor: theme.primary }]}
            onPress={handleCreateConversation}
            disabled={creating}
          >
            {creating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="plus" size={24} color="#fff" />
            )}
          </Pressable>
        </View>
      )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  connectionHeader: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  connectionName: {
    marginBottom: Spacing.xs,
  },
  conversationsSection: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  conversationCard: {
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  conversationTitle: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  conversationMeta: {
    flexDirection: "row",
    gap: Spacing.sm,
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
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  fabContainer: {
    position: "absolute",
    right: Spacing.lg,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
});
