import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { apiRequest, getAuthHeaders } from "@/lib/api";
import {
  getBiometricCapability,
  isBiometricEnabled,
  setBiometricEnabled,
  clearStoredCredentials,
  getBiometricLabel,
  getBiometricIcon,
  BiometricCapability,
} from "@/lib/biometric";
import { Spacing, BorderRadius } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";
import { UserProfile } from "@/types/api";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Settings">;
};

const NOTIFICATIONS_KEY = "@deeper_notifications_enabled";

const SUBSCRIPTION_TIERS: Record<string, { label: string; color: string; connections: number }> = {
  trial: { label: "Trial", color: "#6B7280", connections: 1 },
  basic: { label: "Basic", color: "#3B82F6", connections: 3 },
  advanced: { label: "Advanced", color: "#8B5CF6", connections: 10 },
  unlimited: { label: "Unlimited", color: "#F59E0B", connections: -1 },
};

export default function SettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user, token, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricCapability, setBiometricCapabilityState] = useState<BiometricCapability | null>(null);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadPreferences();
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!token || !user?.email) return;
    try {
      const data = await apiRequest<UserProfile>(
        `/api/mobile/user/profile`,
        { headers: getAuthHeaders(token) }
      );
      setProfile(data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadPreferences = async () => {
    try {
      const notifValue = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (notifValue !== null) {
        setNotificationsEnabled(notifValue === "true");
      }

      if (Platform.OS !== "web") {
        const capability = await getBiometricCapability();
        setBiometricCapabilityState(capability);

        if (capability.isAvailable) {
          const enabled = await isBiometricEnabled();
          setBiometricEnabledState(enabled);
        }
      }
    } catch (error) {
      console.error("Error loading preferences:", error);
    }
  };

  const toggleNotifications = async (value: boolean) => {
    setNotificationsEnabled(value);
    try {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, value.toString());
    } catch (error) {
      console.error("Error saving notification preference:", error);
    }
  };

  const toggleBiometric = async (value: boolean) => {
    if (value) {
      Alert.alert(
        "Enable Biometric Login",
        `When you log in next time, your credentials will be securely stored for ${getBiometricLabel(biometricCapability?.biometricType || "none")} login.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Enable",
            onPress: async () => {
              setBiometricEnabledState(true);
              await setBiometricEnabled(true);
            },
          },
        ]
      );
    } else {
      Alert.alert(
        "Disable Biometric Login",
        "This will remove your stored credentials. You'll need to enter your password to log in.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Disable",
            style: "destructive",
            onPress: async () => {
              setBiometricEnabledState(false);
              await setBiometricEnabled(false);
              await clearStoredCredentials();
            },
          },
        ]
      );
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await clearStoredCredentials();
            logout();
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Deletion",
              "This will permanently delete all your data. Are you absolutely sure?",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete My Account",
                  style: "destructive",
                  onPress: async () => {
                    await clearStoredCredentials();
                    logout();
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const biometricLabel = biometricCapability ? getBiometricLabel(biometricCapability.biometricType) : "";
  const biometricIcon = biometricCapability ? getBiometricIcon(biometricCapability.biometricType) : "shield";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Spacing.xl,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={styles.section}>
          <ThemedText
            type="small"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            SUBSCRIPTION
          </ThemedText>
          <Card elevation={1} style={styles.subscriptionCard}>
            {loadingProfile ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : profile ? (
              <>
                <View style={styles.subscriptionHeader}>
                  <View
                    style={[
                      styles.tierBadge,
                      {
                        backgroundColor:
                          SUBSCRIPTION_TIERS[profile.subscriptionTier]?.color + "20",
                      },
                    ]}
                  >
                    <Feather
                      name="star"
                      size={16}
                      color={SUBSCRIPTION_TIERS[profile.subscriptionTier]?.color}
                    />
                    <ThemedText
                      type="h4"
                      style={{
                        color: SUBSCRIPTION_TIERS[profile.subscriptionTier]?.color,
                        marginLeft: Spacing.xs,
                      }}
                    >
                      {SUBSCRIPTION_TIERS[profile.subscriptionTier]?.label}
                    </ThemedText>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          profile.subscriptionStatus === "active"
                            ? theme.success + "20"
                            : theme.error + "20",
                      },
                    ]}
                  >
                    <ThemedText
                      type="small"
                      style={{
                        color:
                          profile.subscriptionStatus === "active"
                            ? theme.success
                            : theme.error,
                        textTransform: "capitalize",
                      }}
                    >
                      {profile.subscriptionStatus}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.subscriptionInfo}>
                  <View style={styles.subscriptionStat}>
                    <ThemedText type="small" style={{ color: theme.textSecondary }}>
                      Connections Limit
                    </ThemedText>
                    <ThemedText type="h4">
                      {profile.maxConnections === -1 ? "Unlimited" : profile.maxConnections}
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={[styles.upgradeButton, { backgroundColor: theme.primary }]}
                  onPress={() => navigation.navigate("Subscription")}
                >
                  <Feather name="zap" size={16} color="#fff" />
                  <ThemedText type="body" style={{ color: "#fff", marginLeft: Spacing.sm }}>
                    Manage Subscription
                  </ThemedText>
                </Pressable>
              </>
            ) : (
              <ThemedText type="body" style={{ color: theme.textSecondary }}>
                Unable to load subscription info
              </ThemedText>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText
            type="small"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            ACCOUNT
          </ThemedText>
          <Card elevation={1} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Feather name="user" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <ThemedText type="body" style={styles.rowLabel}>
                    Email
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    {user?.email || ""}
                  </ThemedText>
                </View>
              </View>
            </View>
            {profile && (
              <View style={[styles.row, { borderTopWidth: 1, borderTopColor: theme.border }]}>
                <View style={styles.rowContent}>
                  <Feather name="calendar" size={20} color={theme.textSecondary} />
                  <View style={styles.rowText}>
                    <ThemedText type="body" style={styles.rowLabel}>
                      Member Since
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      {new Date(profile.createdAt).toLocaleDateString([], {
                        month: "long",
                        year: "numeric",
                      })}
                    </ThemedText>
                  </View>
                </View>
              </View>
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText
            type="small"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            SECURITY
          </ThemedText>
          <Card elevation={1} style={styles.card}>
            {biometricCapability?.isAvailable && Platform.OS !== "web" ? (
              <View style={[styles.row, styles.rowWithBorder, { borderBottomColor: theme.border }]}>
                <View style={styles.rowContent}>
                  <Feather name={biometricIcon as any} size={20} color={theme.textSecondary} />
                  <View style={styles.rowText}>
                    <ThemedText type="body" style={styles.rowLabel}>
                      {biometricLabel}
                    </ThemedText>
                    <ThemedText
                      type="small"
                      style={{ color: theme.textSecondary }}
                    >
                      Quick login with {biometricLabel.toLowerCase()}
                    </ThemedText>
                  </View>
                </View>
                <Switch
                  value={biometricEnabled}
                  onValueChange={toggleBiometric}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
                />
              </View>
            ) : null}
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Feather name="lock" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <ThemedText type="body" style={styles.rowLabel}>
                    Password
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Change your password
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText
            type="small"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            PREFERENCES
          </ThemedText>
          <Card elevation={1} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Feather name="bell" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <ThemedText type="body" style={styles.rowLabel}>
                    Push Notifications
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Receive updates and alerts
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={toggleNotifications}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={Platform.OS === "ios" ? undefined : "#FFFFFF"}
              />
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText
            type="small"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            ACTIONS
          </ThemedText>
          <Card elevation={1} style={styles.card}>
            <Pressable
              style={({ pressed }) => [
                styles.row,
                styles.actionRow,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleLogout}
            >
              <View style={styles.rowContent}>
                <Feather name="log-out" size={20} color={theme.error} />
                <ThemedText
                  type="body"
                  style={[styles.rowLabel, { color: theme.error }]}
                >
                  Log Out
                </ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </Card>
        </View>

        <View style={styles.section}>
          <ThemedText
            type="small"
            style={[styles.sectionTitle, { color: theme.textSecondary }]}
          >
            DANGER ZONE
          </ThemedText>
          <Card elevation={1} style={styles.card}>
            <Pressable
              style={({ pressed }) => [
                styles.row,
                styles.actionRow,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleDeleteAccount}
            >
              <View style={styles.rowContent}>
                <Feather name="trash-2" size={20} color={theme.error} />
                <View style={styles.rowText}>
                  <ThemedText
                    type="body"
                    style={[styles.rowLabel, { color: theme.error }]}
                  >
                    Delete Account
                  </ThemedText>
                  <ThemedText
                    type="small"
                    style={{ color: theme.textSecondary }}
                  >
                    Permanently remove your account
                  </ThemedText>
                </View>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
    marginLeft: Spacing.xs,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  card: {
    padding: 0,
    overflow: "hidden",
  },
  subscriptionCard: {
    padding: Spacing.lg,
  },
  subscriptionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  subscriptionInfo: {
    marginBottom: Spacing.lg,
  },
  subscriptionStat: {
    gap: Spacing.xs,
  },
  upgradeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  rowWithBorder: {
    borderBottomWidth: 1,
  },
  actionRow: {
    paddingVertical: Spacing.lg,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  rowText: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  rowLabel: {
    marginLeft: Spacing.md,
  },
});
