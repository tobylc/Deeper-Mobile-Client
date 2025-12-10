import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Platform, RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth, registerPushToken, getNotificationPreference } from "@/lib/auth";
import { Spacing } from "@/constants/theme";
import { AppStackParamList } from "@/navigation/RootStackNavigator";

type Props = {
  navigation: NativeStackNavigationProp<AppStackParamList, "Home">;
};

export default function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, token, isLoading, refreshUser } = useAuth();
  const [pushRegistered, setPushRegistered] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token && !pushRegistered) {
      registerForPushNotifications();
    }
  }, [token, pushRegistered]);

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
      await refreshUser();
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
            style={[styles.welcomeEmail, { color: theme.textSecondary }]}
          >
            {user?.email || ""}
          </ThemedText>
        </View>

        <Card elevation={1} style={styles.card}>
          <View style={styles.cardContent}>
            <ThemedText type="h4" style={styles.cardTitle}>
              Getting Started
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Your account is all set up and ready to go. Explore the app to discover all the features available to you.
            </ThemedText>
          </View>
        </Card>

        <Card elevation={1} style={styles.card}>
          <View style={styles.cardContent}>
            <ThemedText type="h4" style={styles.cardTitle}>
              Stay Connected
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.textSecondary }}>
              Enable push notifications in Settings to stay updated with the latest activity and important updates.
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
  welcomeEmail: {},
  card: {
    padding: Spacing.xl,
  },
  cardContent: {
    gap: Spacing.sm,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
  },
});
