// useInviteHandler — owns the full invite-link lifecycle:
//   1. Listens for incoming sidehuddle://i/{code} or universal-link equivalent.
//   2. If user is authenticated: calls accept_room_invite RPC and navigates to the huddle.
//   3. If not authenticated: stores the code in AsyncStorage as a pending invite.
//      RootNavigator consumes the pending invite after auth + (skipped) onboarding.
//
// This hook is the only place that should parse invite URLs.

import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { RootStackParamList } from "@/navigation/types";

export const PENDING_INVITE_KEY = "side-huddle-pending-invite-v1";
export const PENDING_CREATOR_INVITE_KEY = "side-huddle-pending-creator-invite-v1";

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

/**
 * A verified-creator invite token from any of:
 *   https://sidehuddlesports.com/invite/TOKEN
 *   sidehuddle://invite/TOKEN
 */
export function extractCreatorToken(url: string): string | null {
  try {
    const { hostname, path } = Linking.parse(url);
    let raw: string | null = null;
    if (hostname === "invite" && path) raw = path;
    else if (path?.startsWith("invite/")) raw = path.slice("invite/".length);
    if (!raw) return null;
    const token = raw.replace(/^\/+|\/+$/g, "").split(/[/?#]/)[0];
    return /^[A-Za-z0-9_-]{16,64}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}

export async function storePendingCreatorInvite(token: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_CREATOR_INVITE_KEY, token);
}

export async function takePendingCreatorInvite(): Promise<string | null> {
  const token = await AsyncStorage.getItem(PENDING_CREATOR_INVITE_KEY);
  if (token) await AsyncStorage.removeItem(PENDING_CREATOR_INVITE_KEY);
  return token;
}

const CLAIM_ERRORS: Record<string, string> = {
  invite_not_found: "That invite link isn't valid. Ask us for a new one.",
  invite_already_claimed: "That invite link has already been used.",
  invite_revoked: "That invite link was turned off. Ask us for a new one.",
};

/**
 * Claims a creator invite for the signed-in account: the handle is linked,
 * the verified badge set, and their team room created. Lands them in it.
 */
export async function claimCreatorInvite(
  token: string,
  navigation: Nav,
): Promise<{ ok: boolean; huddleId?: string; error?: string }> {
  const { data, error } = await (supabase.rpc as any)("claim_creator_invite", {
    p_token: token,
  });
  if (error) {
    const key = Object.keys(CLAIM_ERRORS).find((k) => error.message?.includes(k));
    Alert.alert("Invite didn't work", key ? CLAIM_ERRORS[key] : "Try the link again in a minute.");
    return { ok: false, error: error.message };
  }
  const row = Array.isArray(data) ? data[0] : data;
  const huddleId: string | undefined = row?.huddle_id;
  if (!huddleId) return { ok: false, error: "no room returned" };
  navigation.navigate("Huddle", { huddleId });
  Alert.alert(
    "You're verified",
    `@${row?.x_handle ?? ""} is linked. This is your room — your posts on X land here on their own.`,
  );
  return { ok: true, huddleId };
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
 * Is there an invite waiting, without consuming it?
 *
 * Onboarding needs to know it's dealing with someone a friend sent, so it can
 * ask for a name and get out of the way instead of running the full sequence.
 * It must NOT consume the code — RootNavigator still redeems it once
 * onboarding_completed flips, and taking it here would drop the invite on the
 * floor and land them on Home instead of in the room they were invited to.
 */
export async function peekPendingInvite(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_INVITE_KEY);
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

      const creatorToken = extractCreatorToken(url);
      if (creatorToken) {
        if (user) await claimCreatorInvite(creatorToken, navigation);
        else await storePendingCreatorInvite(creatorToken);
        return;
      }

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
