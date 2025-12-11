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
import { Connection, getRelationshipDisplay } from "@/types/api";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Connections">;
};

export default function ConnectionsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  React.useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    if (!user?.email || !token) return;

    try {
      const data = await apiRequest<Connection[]>(
        `/api/connections/${encodeURIComponent(user.email)}`,
        { headers: getAuthHeaders(token) }
      );
      setConnections(data);
    } catch (error) {
      console.error("Error fetching connections:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConnections();
    setRefreshing(false);
  }, []);

  const handleAccept = async (connectionId: number) => {
    if (!token || !user?.email) return;

    setActionLoading(connectionId);
    try {
      await apiRequest(
        `/api/connections/${connectionId}/accept`,
        {
          method: "PATCH",
          headers: getAuthHeaders(token),
          body: JSON.stringify({ accepterEmail: user.email }),
        }
      );
      await fetchConnections();
    } catch (error) {
      Alert.alert("Error", "Failed to accept connection");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (connectionId: number) => {
    if (!token || !user?.email) return;

    Alert.alert(
      "Decline Invitation",
      "Are you sure you want to decline this invitation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: async () => {
            setActionLoading(connectionId);
            try {
              await apiRequest(
                `/api/connections/${connectionId}/decline`,
                {
                  method: "PATCH",
                  headers: getAuthHeaders(token),
                  body: JSON.stringify({ declinerEmail: user.email }),
                }
              );
              await fetchConnections();
            } catch (error) {
              Alert.alert("Error", "Failed to decline connection");
            } finally {
              setActionLoading(null);
            }
          },
        },
      ]
    );
  };

  const pendingInvitations = connections.filter(
    (c) => c.status === "pending" && c.inviteeEmail === user?.email
  );
  const sentInvitations = connections.filter(
    (c) => c.status === "pending" && c.inviterEmail === user?.email
  );
  const acceptedConnections = connections.filter((c) => c.status === "accepted");

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

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
        {pendingInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="inbox" size={18} color={theme.primary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Pending Invitations
              </ThemedText>
            </View>
            {pendingInvitations.map((connection) => (
              <Card key={connection.id} elevation={1} style={styles.connectionCard}>
                <View style={styles.connectionInfo}>
                  <ThemedText type="h4">
                    {connection.inviterEmail.split("@")[0]}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                  >
                    {getRelationshipDisplay(
                      connection.relationshipType,
                      connection.inviterRole,
                      connection.inviteeRole
                    )}
                  </ThemedText>
                  {connection.personalMessage && (
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary, marginTop: Spacing.sm, fontStyle: "italic" }}
                    >
                      "{connection.personalMessage}"
                    </ThemedText>
                  )}
                </View>
                <View style={styles.actionButtons}>
                  <Button
                    title="Accept"
                    onPress={() => handleAccept(connection.id)}
                    loading={actionLoading === connection.id}
                    style={styles.acceptButton}
                  />
                  <Button
                    title="Decline"
                    variant="secondary"
                    onPress={() => handleDecline(connection.id)}
                    disabled={actionLoading === connection.id}
                    style={styles.declineButton}
                  />
                </View>
              </Card>
            ))}
          </View>
        )}

        {sentInvitations.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Feather name="send" size={18} color={theme.textSecondary} />
              <ThemedText type="h4" style={styles.sectionTitle}>
                Sent Invitations
              </ThemedText>
            </View>
            {sentInvitations.map((connection) => (
              <Card key={connection.id} elevation={1} style={styles.connectionCard}>
                <View style={styles.connectionInfo}>
                  <ThemedText type="h4">
                    {connection.inviteeEmail.split("@")[0]}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary, marginTop: Spacing.xs }}
                  >
                    {getRelationshipDisplay(
                      connection.relationshipType,
                      connection.inviterRole,
                      connection.inviteeRole
                    )}
                  </ThemedText>
                  <View style={[styles.badge, { backgroundColor: theme.backgroundTertiary }]}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Awaiting response
                    </ThemedText>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="users" size={18} color={theme.success} />
            <ThemedText type="h4" style={styles.sectionTitle}>
              Active Connections
            </ThemedText>
          </View>
          {acceptedConnections.length === 0 ? (
            <Card elevation={1} style={styles.emptyCard}>
              <Feather name="user-plus" size={48} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}
              >
                No active connections yet.{"\n"}Invite someone to start meaningful conversations.
              </ThemedText>
              <Button
                title="Invite Someone"
                onPress={() => navigation.navigate("InviteConnection")}
                style={{ marginTop: Spacing.lg }}
              />
            </Card>
          ) : (
            acceptedConnections.map((connection) => {
              const otherPerson =
                connection.inviterEmail === user?.email
                  ? connection.inviteeEmail
                  : connection.inviterEmail;
              const myRole =
                connection.inviterEmail === user?.email
                  ? connection.inviterRole
                  : connection.inviteeRole;

              return (
                <Pressable
                  key={connection.id}
                  onPress={() =>
                    navigation.navigate("ConversationList", { connectionId: connection.id })
                  }
                >
                  <Card elevation={1} style={styles.connectionCard}>
                    <View style={styles.connectionInfo}>
                      <View style={styles.connectionHeader}>
                        <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                          <ThemedText type="h4" style={{ color: "#fff" }}>
                            {otherPerson.charAt(0).toUpperCase()}
                          </ThemedText>
                        </View>
                        <View style={styles.connectionDetails}>
                          <ThemedText type="h4">{otherPerson.split("@")[0]}</ThemedText>
                          <ThemedText
                            type="small"
                            style={{ color: theme.textSecondary, marginTop: 2 }}
                          >
                            {getRelationshipDisplay(
                              connection.relationshipType,
                              connection.inviterRole,
                              connection.inviteeRole
                            )}
                            {myRole ? ` • You're the ${myRole}` : ""}
                          </ThemedText>
                        </View>
                      </View>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={[styles.fabContainer, { bottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          style={[styles.fab, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate("InviteConnection")}
        >
          <Feather name="plus" size={24} color="#fff" />
        </Pressable>
      </View>
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
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  connectionCard: {
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  connectionInfo: {
    flex: 1,
  },
  connectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  connectionDetails: {
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
  },
  actionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  acceptButton: {
    flex: 1,
  },
  declineButton: {
    flex: 1,
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
