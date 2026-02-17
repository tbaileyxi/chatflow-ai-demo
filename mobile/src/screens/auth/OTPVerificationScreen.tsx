import { useState, useEffect, useRef } from "react";
import { View, Text, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/colors";
import { env } from "@/config/env";
import type { AuthStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList, "OTPVerification">;
type Route = RouteProp<AuthStackParamList, "OTPVerification">;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export function OTPVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { phone } = route.params;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleVerify = async () => {
    if (code.length !== CODE_LENGTH) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: "sms",
      });

      if (error) {
        Alert.alert("Verification Failed", error.message);
        setCode("");
        return;
      }

      if (data.user) {
        await ensureProfile(data.user.id, phone);
      }
      // Auth state change in useAuth will handle navigation
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendTimer(RESEND_COOLDOWN);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) {
        Alert.alert("Error", error.message);
      }
    } catch {
      Alert.alert("Error", "Failed to resend code.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-4 pt-2">
        <Button
          variant="ghost"
          size="icon"
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft color={colors.foreground} size={24} />
        </Button>
      </View>

      <View className="flex-1 px-8 pt-8">
        <Text className="text-2xl font-bold text-foreground">
          Enter verification code
        </Text>
        <Text className="mt-2 text-base text-muted-foreground">
          Sent to {phone}
        </Text>

        <View className="mt-8 gap-6">
          {/* Hidden input captures keyboard, boxes display digits */}
          <View>
            <TextInput
              ref={inputRef}
              value={code}
              onChangeText={(t) => {
                const digits = t.replace(/\D/g, "").slice(0, CODE_LENGTH);
                setCode(digits);
              }}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH}
              autoFocus
              className="absolute h-0 w-0 opacity-0"
            />

            <View className="flex-row justify-between gap-2">
              {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  className={`h-14 flex-1 items-center justify-center rounded-lg border ${
                    code.length === i
                      ? "border-primary"
                      : code[i]
                        ? "border-foreground"
                        : "border-border"
                  } bg-background`}
                  onTouchEnd={() => inputRef.current?.focus()}
                >
                  <Text className="text-2xl font-semibold text-foreground">
                    {code[i] ?? ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <Button
            size="lg"
            onPress={handleVerify}
            disabled={loading || code.length !== CODE_LENGTH}
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>

          <View className="items-center">
            {resendTimer > 0 ? (
              <Text className="text-sm text-muted-foreground">
                Resend code in {resendTimer}s
              </Text>
            ) : (
              <Button variant="ghost" onPress={handleResend}>
                Resend Code
              </Button>
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

async function ensureProfile(userId: string, phone: string) {
  // Check if profile exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .single();

  if (!existing) {
    // Create new profile
    await supabase.from("profiles").insert({
      user_id: userId,
      phone_number: phone,
      signup_method: "phone",
      onboarding_completed: false,
    });
  }

  // Check admin status
  if (env.adminPhoneNumber && phone === env.adminPhoneNumber) {
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .single();

    if (!existingRole) {
      await supabase.from("user_roles").insert({
        user_id: userId,
        role: "admin",
      });
    }
  }
}
