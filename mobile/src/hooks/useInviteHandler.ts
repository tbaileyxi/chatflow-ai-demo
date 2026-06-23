// useInviteHandler — owns the full invite-link lifecycle:
//   1. Listens for incoming sidehuddle://i/{code} or universal-link equivalent.
//   2. If user is authenticated: calls accept_room_invite RPC and navigates to the huddle.
//   3. If not authenticated: stores the code in AsyncStorage as a pending invite.
//      RootNavigator consumes the pending invite after auth + (skipped) onboarding.
//
// This hook is the only place that should parse invite URLs.

import { useEffect, useRef } from "react";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RootStackParamList } from "@/navigation/types";

export const PENDING_INVITE_KEY = "side-huddle-pending-invite-v1";

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Extracts an invite code from any of:
 *   sidehuddle://i/abc123
 *   exp://...?--/i/abc123 (Expo dev clients)
 *   https://sidehuddle.com/i/abc123 (future universal link)
 */
export function extractInviteCode(url: string): string | null {
  try {
    const { hostname, path, queryParams } = Linking.parse(url);
    // Custom scheme: sidehuddle://i/CODE → hostname = "i", path = "CODE"
    if (hostname === "i" && path) return cleanCode(path);
    // Universal link: https://sidehuddle.com/i/CODE → hostname = "sidehuddle.com", path = "i/CODE"
    if (path?.startsWith("i/")) return cleanCode(path.slice(2));
    if (path === "i" && queryParams?.code) return cleanCode(String(queryParams.code));
    return null;
  } catch {
    return null;
  }
}

function cleanCode(raw: string): string | null {
  const trimmed = raw.replace(/^\/+|\/+$/g, "").split("/")[0]?.split("?")[0];
  return trimmed && trimmed.length >= 6 && trimmed.length <= 32 ? trimmed : null;
}

export async function storePendingInvite(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_INVITE_KEY, code);
}

export async function takePendingInvite(): Promise<string | null> {
  const code = await AsyncStorage.getItem(PENDING_INVITE_KEY);
  if (code) await AsyncStorage.removeItem(PENDING_INVITE_KEY);
  return code;
}

/**
 * Accepts an invite code and navigates to the resulting huddle.
 * Safe to call from any signed-in surface.
 */
export async function consumeInvite(
  code: string,
  navigation: Nav,
): Promise<{ ok: boolean; huddleId?: string; error?: string }> {
  // RPC name not in generated types yet (added 20260608000001); cast through any.
  const { data, error } = await (supabase.rpc as any)("accept_room_invite", {
    p_invite_code: code,
  });
  if (error) {
    console.warn("[invite] accept failed", error);
    return { ok: false, error: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const huddleId: string | undefined = row?.huddle_id;
  if (!huddleId) return { ok: false, error: "no huddle returned" };
  navigation.navigate("Huddle", { huddleId });
  return { ok: true, huddleId };
}

/**
 * Top-level effect: parses incoming URLs and acts based on auth state.
 * Mount this once at the root.
 */
export function useInviteHandler() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const handledRef = useRef<Set<string>>(new Set());

  // Handle URLs that arrive while the app is running.
  useEffect(() => {
    const handle = async (url: string | null) => {
      if (!url || handledRef.current.has(url)) return;
      handledRef.current.add(url);
      const code = extractInviteCode(url);
      if (!code) return;
      if (user) {
        await consumeInvite(code, navigation);
      } else {
        await storePendingInvite(code);
      }
    };

    // Cold-start URL (app opened from a tap when not running).
    Linking.getInitialURL().then(handle);

    // Subsequent URLs (app already running).
    const sub = Linking.addEventListener("url", ({ url }) => handle(url));
    return () => sub.remove();
  }, [user, navigation]);
}
