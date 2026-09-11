// Official Huddle upgrade paywall.
//
// Lightweight bottom sheet shown when a non-admin owner taps "Make Official"
// in HuddleSettings.  Fetches the current RC offering, lets the user buy,
// then calls our backend to flip the huddle's official_status.
//
// Test Store key is sandbox-only — the sheet will render a placeholder when
// no real offering exists yet.  Swap to the appl_ key + register the
// official_huddle_monthly product to see live pricing.

import { useEffect, useState } from "react";
import { Alert, Linking, Modal, Pressable, Text, View } from "react-native";
import { ShieldCheck, X } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import {
  ensureConfigured,
  fetchOfficialHuddlePackage,
  purchaseOfficialHuddle,
  activateOfficialOnHuddle,
} from "@/lib/revenuecat";
import { Type } from "@/components/ui/Type";
import { Button } from "@/components/ui/button";
import { PRIVACY_URL, TERMS_URL } from "@/lib/legal";
import { colors } from "@/theme/colors";

type Props = {
  visible: boolean;
  huddleId: string;
  huddleName: string;
  onClose: () => void;
  onActivated: () => void;
};

export function OfficialUpgradePaywall({
  visible,
  huddleId,
  huddleName,
  onClose,
  onActivated,
}: Props) {
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      await ensureConfigured();
      const found = await fetchOfficialHuddlePackage();
      if (!cancelled) {
        setPkg(found);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handlePurchase = async () => {
    if (!pkg) return;
    setBusy(true);
    const result = await purchaseOfficialHuddle(pkg);
    if (result.cancelled) {
      setBusy(false);
      return;
    }
    if (!result.ok) {
      setBusy(false);
      Alert.alert("Purchase failed", result.error ?? "Try again in a moment.");
      return;
    }
    // Tell backend to flip the huddle Official.  Webhook usually beats us
    // here, but the RPC is idempotent.
    const activate = await activateOfficialOnHuddle(huddleId);
    setBusy(false);
    if (!activate.ok) {
      Alert.alert(
        "Almost there",
        "Purchase went through but we couldn't activate Official on this room yet. Try again in a minute — it'll sync.",
      );
      return;
    }
    onActivated();
    onClose();
  };

  const priceLabel =
    pkg?.product?.priceString ?? "$29.99 / month";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black/50" onPress={onClose}>
        <View className="flex-1 justify-end">
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-t-3xl border-t border-border bg-background px-6 pb-10 pt-5"
          >
            {/* Drag handle + close */}
            <View className="mb-4 flex-row items-center">
              <View className="flex-1 items-center">
                <View className="h-1.5 w-12 rounded-full bg-muted" />
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X color={colors.mutedForeground} size={22} />
              </Pressable>
            </View>

            {/* Header */}
            <View className="mb-5 flex-row items-center gap-2">
              <ShieldCheck color={colors.primary} size={22} />
              <Type variant="title">
                Make {huddleName} Official
              </Type>
            </View>

            {/* Benefits */}
            <View className="mb-6 gap-2.5">
              {[
                "Verified badge on the room",
                "Custom website link",
                "Add multiple admins",
                "Private / approval-only membership",
                "Get discovered in Search",
              ].map((line) => (
                <View key={line} className="flex-row items-center gap-2">
                  <Type variant="body" tone="primary">✓</Type>
                  <Type variant="body">{line}</Type>
                </View>
              ))}
            </View>

            {/* Price + CTA */}
            {loading ? (
              <View className="items-center py-4">
                <Type variant="caption" tone="muted">Loading…</Type>
              </View>
            ) : pkg ? (
              <>
                <Type variant="bodyStrong" className="mb-1 text-center">
                  Official Huddle
                </Type>
                <Type variant="title" className="mb-1 text-center">
                  {priceLabel}
                </Type>
                <Type variant="caption" tone="muted" className="mb-4 text-center">
                  1-month auto-renewing subscription. Payment is charged to your
                  Apple ID at confirmation of purchase and renews automatically
                  for {priceLabel} each month unless cancelled at least 24 hours
                  before the end of the current period. Manage or cancel in your
                  Apple ID settings.
                </Type>
                <Button onPress={handlePurchase} disabled={busy}>
                  {busy ? "Processing…" : "Make Official"}
                </Button>
              </>
            ) : (
              <View className="rounded-xl border border-border bg-muted p-4">
                <Type variant="captionStrong">
                  Subscription not yet available
                </Type>
                <Type variant="caption" tone="muted" className="mt-1">
                  Our products are syncing with the App Store. Try again in a
                  few minutes. If this persists, contact support.
                </Type>
              </View>
            )}

            {/* Required by 3.1.2(c) — rendered even when the offering fails to
                load, so the links are never missing from the purchase screen. */}
            <View className="mt-5 flex-row items-center justify-center gap-6">
              <Pressable
                onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
                hitSlop={8}
              >
                <Type variant="captionStrong" tone="muted" className="underline">
                  Terms of Use (EULA)
                </Type>
              </Pressable>
              <Pressable
                onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}
                hitSlop={8}
              >
                <Type variant="captionStrong" tone="muted" className="underline">
                  Privacy Policy
                </Type>
              </Pressable>
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
