import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { router } from "expo-router";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type?: string;
  screen?: string;
  params?: Record<string, any>;
}

export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationResponse?: (response: Notifications.NotificationResponse) => void
) {
  if (Platform.OS === "web") {
    return { removeListeners: () => {} };
  }

  const notificationListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    }
  );

  const responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
      handleNotificationResponse(response);
    }
  );

  return {
    removeListeners: () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    },
  };
}

function handleNotificationResponse(response: Notifications.NotificationResponse) {
  const data = response.notification.request.content.data as NotificationData;

  if (data?.screen) {
    try {
      router.push(data.screen as any);
    } catch (error) {
      console.error("Error navigating from notification:", error);
    }
  }
}

export async function getBadgeCount(): Promise<number> {
  if (Platform.OS === "web") return 0;
  
  try {
    return await Notifications.getBadgeCountAsync();
  } catch {
    return 0;
  }
}

export async function setBadgeCount(count: number): Promise<void> {
  if (Platform.OS === "web") return;
  
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.error("Error setting badge count:", error);
  }
}

export async function clearBadge(): Promise<void> {
  await setBadgeCount(0);
}

export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: NotificationData,
  trigger?: Notifications.NotificationTriggerInput
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
      },
      trigger: trigger || null,
    });
    return id;
  } catch (error) {
    console.error("Error scheduling notification:", error);
    return null;
  }
}

export async function cancelNotification(notificationId: string): Promise<void> {
  if (Platform.OS === "web") return;
  
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    console.error("Error canceling notification:", error);
  }
}

export async function cancelAllNotifications(): Promise<void> {
  if (Platform.OS === "web") return;
  
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.error("Error canceling all notifications:", error);
  }
}

export async function getLastNotificationResponse(): Promise<Notifications.NotificationResponse | null> {
  if (Platform.OS === "web") return null;
  
  try {
    return await Notifications.getLastNotificationResponseAsync();
  } catch {
    return null;
  }
}
