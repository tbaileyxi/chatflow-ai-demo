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
import { Alert, Modal, Pressable, Text, View } from "react-native";
import { ShieldCheck, X } from "lucide-react-native";
import type { PurchasesPackage } from "react-native-purchases";
import {
  ensureConfigured,
  fetchOfficialHuddlePackage,
  purchaseOfficialHuddle,
  activateOfficialOnHuddle,
} from "@/lib/revenuecat";
import { Button } from "@/components/ui/button";
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
              <Text className="text-xl font-black text-foreground">
                Make {huddleName} Official
              </Text>
            </View>

            {/* Benefits */}
            <View className="mb-6 gap-2.5">
              {[
                "Verified badge on the room",
                "Custom website link",
                "Add multiple admins",
                "Private / approval-only membership",
                "Listed on the team page",
              ].map((line) => (
                <View key={line} className="flex-row items-center gap-2">
                  <Text className="text-base text-primary">✓</Text>
                  <Text className="text-base text-foreground">{line}</Text>
                </View>
              ))}
            </View>

            {/* Price + CTA */}
            {loading ? (
              <View className="items-center py-4">
                <Text className="text-sm text-muted-foreground">Loading…</Text>
              </View>
            ) : pkg ? (
              <>
                <Text className="mb-1 text-center text-2xl font-black text-foreground">
                  {priceLabel}
                </Text>
                <Text className="mb-4 text-center text-xs text-muted-foreground">
                  Auto-renews monthly. Cancel anytime in your Apple ID settings.
                </Text>
                <Button onPress={handlePurchase} disabled={busy}>
                  {busy ? "Processing…" : "Make Official"}
                </Button>
              </>
            ) : (
              <View className="rounded-xl border border-border bg-muted p-4">
                <Text className="text-sm font-bold text-foreground">
                  Subscription not yet available
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                  Our products are syncing with the App Store. Try again in a
                  few minutes. If this persists, contact support.
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}
