import { useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { consumeInvite, extractInviteCode } from "@/hooks/useInviteHandler";

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log("Push notifications require a physical device");
    return null;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Push notification permission not granted");
    return null;
  }

  // Get Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });

  // Android-specific channel setup
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return tokenData.data;
}

export function useNotifications() {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  // Register for push notifications and store token
  useEffect(() => {
    if (!user) return;

    registerForPushNotificationsAsync().then(async (token) => {
      if (!token) return;
      setExpoPushToken(token);

      // Store the push token in the user's profile
      // Note: expo_push_token column must be added via migration
      await supabase
        .from("profiles")
        .update({ expo_push_token: token } as any)
        .eq("user_id", user.id);
    });

    // Listen for incoming notifications while app is in foreground
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        console.log("Notification received:", notification);
      });

    // Handle notification tap (opens the app)
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;

        // Room invite: the payload carries an invite deep link (sidehuddle://i/CODE)
        // and NO huddleId — tapping must actually ACCEPT the invite (join +
        // friend-connect via accept_room_invite), then route into the huddle.
        // Without this, tapping the push did nothing and the join silently failed.
        const inviteCode =
          typeof data?.url === "string" ? extractInviteCode(data.url) : null;
        if (inviteCode) {
          consumeInvite(inviteCode, navigation as any);
          return;
        }

        // Navigate based on notification type
        if (data?.huddleId) {
          navigation.navigate("Huddle" as any, {
            huddleId: data.huddleId as string,
          });
        } else if (data?.type === "kalshi_closing") {
          navigation.navigate("Ledger" as any);
        }
      });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user, navigation]);

  return { expoPushToken };
}
