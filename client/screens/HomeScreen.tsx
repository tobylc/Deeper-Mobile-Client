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
  sentInvitations: number;
  activeConversations: number;
  myTurnCount: number;
}

interface TrialStatus {
  isExpired: boolean;
  daysRemaining: number;
  subscriptionTier: string;
  subscriptionStatus: string;
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
    sentInvitations: 0,
    activeConversations: 0,
    myTurnCount: 0,
  });
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
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
      fetchTrialStatus();
    }
  }, [token, user?.email]);

  const fetchTrialStatus = async () => {
    if (!token) return;
    try {
      const data = await apiRequest<TrialStatus>(
        "/api/trial-status",
        { headers: getAuthHeaders(token) }
      );
      setTrialStatus(data);
    } catch (error) {
      console.log("Trial status not available");
    }
  };

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
      const sent = connections.filter(
        (c) => c.status === "pending" && c.inviterEmail === user.email
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
        } catch (e) {}
      }

      setStats({
        totalConnections: acceptedConnections.length,
        pendingInvitations: pending.length,
        sentInvitations: sent.length,
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

      if (finalStatus !== "granted") return;

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
      await Promise.all([refreshUser(), fetchDashboardData(), fetchTrialStatus()]);
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

  const isInviteeUser = recentConnections.some((c) => c.inviteeEmail === user?.email);
  const userConnectionLimit = (user as any)?.maxConnections || 1;
  const subscriptionTier = (user as any)?.subscriptionTier || "trial";

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
            Your Connection Dashboard
          </ThemedText>
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Manage your meaningful conversations and connections
          </ThemedText>
        </View>

        <Card elevation={2} style={{ ...styles.subscriptionCard, borderColor: theme.accent + "50" }}>
          <View style={styles.subscriptionHeader}>
            <View style={styles.subscriptionTitleRow}>
              <View style={[styles.subscriptionIcon, { backgroundColor: theme.accent + "20" }]}>
                <Feather name="award" size={18} color={theme.accent} />
              </View>
              <ThemedText type="h4">Subscription Status</ThemedText>
            </View>
            <Pressable
              style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
              onPress={() => navigation.navigate("Subscription")}
            >
              <ThemedText type="small" style={{ color: "#fff" }}>Upgrade</ThemedText>
            </Pressable>
          </View>
          
          <View style={styles.subscriptionStats}>
            <View style={styles.subscriptionStatItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Current Plan</ThemedText>
              <View style={[styles.tierBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="body" style={{ fontWeight: "600", textTransform: "capitalize" }}>
                  {subscriptionTier}
                </ThemedText>
              </View>
              {trialStatus && subscriptionTier === "trial" && trialStatus.daysRemaining > 0 ? (
                <ThemedText type="small" style={{ color: theme.textSecondary, marginTop: Spacing.xs }}>
                  {trialStatus.daysRemaining} day{trialStatus.daysRemaining !== 1 ? "s" : ""} remaining
                </ThemedText>
              ) : null}
            </View>
            
            <View style={styles.subscriptionStatItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Connections</ThemedText>
              <ThemedText type="h3" style={{ color: theme.accent }}>
                {stats.totalConnections + stats.sentInvitations} / {userConnectionLimit}
              </ThemedText>
            </View>
            
            <View style={styles.subscriptionStatItem}>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>Active</ThemedText>
              <ThemedText type="h3" style={{ color: theme.primary }}>
                {stats.totalConnections}
              </ThemedText>
            </View>
          </View>

          <ThemedText type="small" style={{ color: theme.textSecondary, textAlign: "center", marginTop: Spacing.md }}>
            Only paid members can invite others
          </ThemedText>
        </Card>

        <View style={styles.quickActionsGrid}>
          <Pressable
            style={styles.quickActionCard}
            onPress={() => navigation.navigate("Connections")}
          >
            <Card elevation={1} style={styles.quickActionInner}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.primary + "15" }]}>
                <Feather name="message-circle" size={24} color={theme.primary} />
              </View>
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {loadingStats ? "-" : stats.activeConversations}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Active Conversations
              </ThemedText>
            </Card>
          </Pressable>

          <Pressable
            style={styles.quickActionCard}
            onPress={() => navigation.navigate("Connections")}
          >
            <Card elevation={1} style={styles.quickActionInner}>
              <View style={[styles.quickActionIcon, { backgroundColor: theme.accent + "15" }]}>
                <Feather name="inbox" size={24} color={theme.accent} />
              </View>
              <ThemedText type="h2" style={{ marginTop: Spacing.sm }}>
                {loadingStats ? "-" : stats.pendingInvitations}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.textSecondary }}>
                Pending Invites
              </ThemedText>
            </Card>
          </Pressable>
        </View>

        {!isInviteeUser ? (
          <Pressable onPress={() => navigation.navigate("InviteConnection")}>
            <Card elevation={1} style={{ ...styles.inviteCard, backgroundColor: theme.primary }}>
              <Feather name="user-plus" size={24} color="#fff" />
              <ThemedText type="h4" style={{ color: "#fff", marginLeft: Spacing.md }}>
                Send New Invitation
              </ThemedText>
            </Card>
          </Pressable>
        ) : null}

        {stats.pendingInvitations > 0 ? (
          <Pressable onPress={() => navigation.navigate("Connections")}>
            <Card elevation={1} style={{ ...styles.alertCard, backgroundColor: theme.accent + "15" }}>
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
        ) : null}

        {stats.myTurnCount > 0 ? (
          <Pressable onPress={() => navigation.navigate("Connections")}>
            <Card elevation={1} style={{ ...styles.alertCard, backgroundColor: theme.primary + "15" }}>
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
        ) : null}

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
            recentConnections.map((connection, index) => {
              const otherPerson = getOtherPersonEmail(connection).split("@")[0];
              const isInviter = connection.inviterEmail === user?.email;
              const borderColor = isInviter ? theme.primary : theme.accent;
              
              return (
                <Pressable
                  key={connection.id}
                  onPress={() => navigation.navigate("ConversationList", { connectionId: connection.id })}
                >
                  <Card
                    elevation={1}
                    style={{ ...styles.connectionCard, borderLeftWidth: 4, borderLeftColor: borderColor }}
                  >
                    <View style={[styles.connectionAvatar, { backgroundColor: borderColor }]}>
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
                        {connection.inviterRole && connection.inviteeRole
                          ? ` - ${isInviter ? connection.inviterRole : connection.inviteeRole}`
                          : ""}
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
  subscriptionCard: {
    padding: Spacing.lg,
    borderWidth: 1,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  subscriptionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  subscriptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  upgradeButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  subscriptionStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  subscriptionStatItem: {
    alignItems: "center",
  },
  tierBadge: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
  },
  quickActionsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  quickActionCard: {
    flex: 1,
  },
  quickActionInner: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteCard: {
    padding: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
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
