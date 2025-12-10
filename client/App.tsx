import React, { useEffect } from "react";
import { StyleSheet, Platform, Alert } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/lib/auth";
import { setupNotificationListeners, clearBadge } from "@/lib/notifications";

function NotificationHandler() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    const { removeListeners } = setupNotificationListeners(
      (notification) => {
        const { title, body } = notification.request.content;
        console.log("Notification received:", { title, body });
      },
      (response) => {
        const { title, body } = response.notification.request.content;
        console.log("Notification tapped:", { title, body });
        clearBadge();
      }
    );

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("App opened from notification");
        clearBadge();
      }
    });

    return () => {
      removeListeners();
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root}>
              <KeyboardProvider>
                <NavigationContainer>
                  <NotificationHandler />
                  <RootStackNavigator />
                </NavigationContainer>
                <StatusBar style="auto" />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
