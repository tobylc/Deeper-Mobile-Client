import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/lib/auth";
import { Spacing, BorderRadius } from "@/constants/theme";

const NOTIFICATIONS_KEY = "@deeper_notifications_enabled";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  React.useEffect(() => {
    loadNotificationPreference();
  }, []);

  const loadNotificationPreference = async () => {
    try {
      const value = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (value !== null) {
        setNotificationsEnabled(value === "true");
      }
    } catch (error) {
      console.error("Error loading notification preference:", error);
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

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out",
          style: "destructive",
          onPress: () => logout(),
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
                  onPress: () => {
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
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
