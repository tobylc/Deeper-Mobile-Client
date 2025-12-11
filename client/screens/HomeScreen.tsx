import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, registerPushToken, getNotificationPreference } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import { Connection, Conversation } from "@/types/api";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Home">;
};

interface DashboardStats {
  totalConnections: number;
  pendingInvitations: number;
  activeConversations: number;
  myTurnCount: number;
}

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token, isLoading, refreshUser } = useAuth();
  const [pushRegistered, setPushRegistered] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalConnections: 0,
    pendingInvitations: 0,
    activeConversations: 0,
    myTurnCount: 0,
  });
  const [recentConnections, setRecentConnections] = useState<Connection[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (token && !pushRegistered) {
      registerForPushNotifications();
    }
  }, [token, pushRegistered]);

  useEffect(() => {
    if (token && user?.email) {
      fetchDashboardData();
    }
  }, [token, user?.email]);

  const fetchDashboardData = async () => {
    if (!token || !user?.email) return;

    try {
      const connections = await apiRequest<Connection[]>(
        `/api/connections/${encodeURIComponent(user.email)}`,
        { headers: getAuthHeaders(token) }
      );

      const acceptedConnections = connections.filter((c) => c.status === "accepted");
      const pending = connections.filter(
        (c) => c.status === "pending" && c.inviteeEmail === user.email
      );

      let totalConversations = 0;
      let myTurnCount = 0;

      for (const conn of acceptedConnections.slice(0, 5)) {
        try {
          const convos = await apiRequest<Conversation[]>(
            `/api/conversations/connection/${conn.id}`,
            { headers: getAuthHeaders(token) }
          );
          totalConversations += convos.filter((c) => c.status === "active").length;
          myTurnCount += convos.filter((c) => c.currentTurn === user.email).length;
        } catch (e) {
          // Ignore errors fetching conversations
        }
      }

      setStats({
        totalConnections: acceptedConnections.length,
        pendingInvitations: pending.length,
        activeConversations: totalConversations,
        myTurnCount,
      });
      setRecentConnections(acceptedConnections.slice(0, 3));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoadingStats(false);
    }
  };

  const registerForPushNotifications = async () => {
    if (Platform.OS === "web") return;

    try {
      const notificationsEnabled = await getNotificationPreference();
      if (!notificationsEnabled) return;

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        return;
      }

      const pushToken = await Notifications.getExpoPushTokenAsync();
      if (token && pushToken.data) {
        await registerPushToken(token, pushToken.data);
        setPushRegistered(true);
      }
    } catch (error) {
      console.error("Failed to register push notifications:", error);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([refreshUser(), fetchDashboardData()]);
    } finally {
      setRefreshing(false);
    }
  }, [refreshUser]);

  if (isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </ThemedView>
    );
  }

  const getOtherPersonEmail = (connection: Connection) => {
    return connection.inviterEmail === user?.email
      ? connection.inviteeEmail
      : connection.inviterEmail;
  };

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
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.welcomeSection}>
          <ThemedText type="h2" style={styles.welcomeTitle}>
            Welcome back
          </ThemedText>
          <ThemedText
            type="body"
            style={{ color: theme.textSecondary }}
          >
            {user?.email?.split("@")[0] || ""}
          </ThemedText>
        </View>

        {stats.pendingInvitations > 0 && (
          <Pressable onPress={() => navigation.navigate("Connections")}>
            <Card
              elevation={1}
              style={[styles.alertCard, { backgroundColor: theme.accent + "15" }]}
            >
              <View style={styles.alertContent}>
                <View style={[styles.alertIcon, { backgroundColor: theme.accent + "30" }]}>
                  <Feather name="inbox" size={20} color={theme.accent} />
                </View>
                <View style={styles.alertText}>
                  <ThemedText type="h4">
                    {stats.pendingInvitations} Pending Invitation{stats.pendingInvitations > 1 ? "s" : ""}
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    Tap to review and respond
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Card>
          </Pressable>
        )}

        {stats.myTurnCount > 0 && (
          <Pressable onPress={() => navigation.navigate("Connections")}>
            <Card
              elevation={1}
              style={[styles.alertCard, { backgroundColor: theme.primary + "15" }]}
            >
              <View style={styles.alertContent}>
                <View style={[styles.alertIcon, { backgroundColor: theme.primary + "30" }]}>
                  <Feather name="message-circle" size={20} color={theme.primary} />
                </View>
                <View style={styles.alertText}>
                  <ThemedText type="h4">
                    {stats.myTurnCount} Conversation{stats.myTurnCount > 1 ? "s" : ""} Waiting
                  </ThemedText>
                  <ThemedText type="small" style={{ color: theme.textSecondary }}>
                    It's your turn to respond
                  </ThemedText>
                </View>
                <Feather name="chevron-right" size={20} color={theme.textSecondary} />
              </View>
            </Card>
          </Pressable>
        )}

        <View style={styles.statsGrid}>
          <Pressable
            style={styles.statCard}
            onPress={() => navigation.navigate("Connections")}
          >
            <Card elevation={1} style={styles.statCardInner}>
              <View style={[styles.statIcon, { backgroundColor: theme.primary + "20" }]}>
                <Feather name="users" size={20} color={theme.primary} />
              </View>
              <ThemedText type="h2" style={styles.statNumber}>
                {loadingStats ? "-" : stats.totalConnections}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Connections
              </ThemedText>
            </Card>
          </Pressable>

          <Pressable
            style={styles.statCard}
            onPress={() => navigation.navigate("Connections")}
          >
            <Card elevation={1} style={styles.statCardInner}>
              <View style={[styles.statIcon, { backgroundColor: theme.success + "20" }]}>
                <Feather name="message-square" size={20} color={theme.success} />
              </View>
              <ThemedText type="h2" style={styles.statNumber}>
                {loadingStats ? "-" : stats.activeConversations}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Active Threads
              </ThemedText>
            </Card>
          </Pressable>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="h4">Recent Connections</ThemedText>
            <Pressable onPress={() => navigation.navigate("Connections")}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                View All
              </ThemedText>
            </Pressable>
          </View>

          {loadingStats ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : recentConnections.length === 0 ? (
            <Card elevation={1} style={styles.emptyCard}>
              <Feather name="user-plus" size={32} color={theme.textSecondary} />
              <ThemedText
                type="body"
                style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}
              >
                No connections yet.{"\n"}Start by inviting someone.
              </ThemedText>
              <Pressable
                style={[styles.emptyButton, { backgroundColor: theme.primary }]}
                onPress={() => navigation.navigate("InviteConnection")}
              >
                <Feather name="plus" size={16} color="#fff" />
                <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
                  Invite Someone
                </ThemedText>
              </Pressable>
            </Card>
          ) : (
            recentConnections.map((connection) => {
              const otherPerson = getOtherPersonEmail(connection).split("@")[0];
              return (
                <Pressable
                  key={connection.id}
                  onPress={() => navigation.navigate("ConversationList", { connectionId: connection.id })}
                >
                  <Card elevation={1} style={styles.connectionCard}>
                    <View style={[styles.connectionAvatar, { backgroundColor: theme.primary }]}>
                      <ThemedText type="h4" style={{ color: "#fff" }}>
                        {otherPerson.charAt(0).toUpperCase()}
                      </ThemedText>
                    </View>
                    <View style={styles.connectionInfo}>
                      <ThemedText type="body" style={{ fontWeight: "600" }}>
                        {otherPerson}
                      </ThemedText>
                      <ThemedText type="small" style={{ color: theme.textSecondary }}>
                        {connection.relationshipType}
                      </ThemedText>
                    </View>
                    <Feather name="chevron-right" size={20} color={theme.textSecondary} />
                  </Card>
                </Pressable>
              );
            })
          )}
        </View>

        <Card elevation={1} style={styles.tipCard}>
          <View style={[styles.tipIcon, { backgroundColor: theme.accent + "20" }]}>
            <Feather name="zap" size={20} color={theme.accent} />
          </View>
          <View style={styles.tipContent}>
            <ThemedText type="h4">Tip: Take Your Time</ThemedText>
            <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
              Deeper conversations work best when you give thoughtful responses.
              There's no rush - take time to reflect before responding.
            </ThemedText>
          </View>
        </Card>
      </ScrollView>
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
    gap: Spacing.lg,
  },
  welcomeSection: {
    marginBottom: Spacing.sm,
  },
  welcomeTitle: {
    marginBottom: Spacing.xs,
  },
  alertCard: {
    padding: Spacing.lg,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  alertIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  alertText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
  },
  statCardInner: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  statNumber: {
    marginBottom: Spacing.xs,
  },
  section: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  emptyCard: {
    padding: Spacing.xl,
    alignItems: "center",
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  connectionCard: {
    padding: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
  },
  connectionAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  connectionInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  tipCard: {
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tipIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  tipContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
});
