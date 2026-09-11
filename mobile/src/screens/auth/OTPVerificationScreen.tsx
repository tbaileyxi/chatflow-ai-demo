import { useState, useEffect, useRef } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/colors";
import { env } from "@/config/env";
import {
  isReviewerEmail,
  REVIEWER_CODE,
  REVIEWER_EMAIL,
  REVIEWER_PASSWORD,
} from "@/config/reviewer";
import type { AuthStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList, "OTPVerification">;
type Route = RouteProp<AuthStackParamList, "OTPVerification">;

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export function OTPVerificationScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { phone, email, method = phone ? "sms" : "email" } = route.params;

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
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
    Keyboard.dismiss();

    setLoading(true);
    setErrorMessage("");
    setStatusMessage("Checking code...");
    console.log("Verifying OTP - method:", method, "phone:", phone, "email:", email);
    try {
      // App Store reviewer bypass: the fixed reviewer email + code signs in
      // through the pre-provisioned password account instead of verifyOtp,
      // since no OTP email was ever sent for this address.
      if (
        method === "email" &&
        email &&
        isReviewerEmail(email) &&
        code === REVIEWER_CODE
      ) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: REVIEWER_EMAIL,
          password: REVIEWER_PASSWORD,
        });
        if (error) {
          setErrorMessage(error.message);
          Alert.alert("Verification Failed", error.message);
          setCode("");
          return;
        }
        if (data.user) {
          setStatusMessage("Signed in. Loading app...");
          await ensureProfile(data.user.id, { email, method });
        }
        return;
      }

      const { data, error } =
        method === "email"
          ? await supabase.auth.verifyOtp({
              email: email!,
              token: code,
              type: "email",
            })
          : await supabase.auth.verifyOtp({
              phone: phone!,
              token: code,
              type: "sms",
            });

      console.log("Verify result - error:", error?.message, "user:", data?.user?.id);

      if (error) {
        setErrorMessage(error.message);
        Alert.alert("Verification Failed", error.message);
        setCode("");
        return;
      }

      if (data.user) {
        setStatusMessage("Signed in. Loading app...");
        await ensureProfile(data.user.id, { phone, email, method });
      }
      // Auth state change in useAuth will handle navigation
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.";
      setErrorMessage(message);
      Alert.alert("Error", message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendTimer(RESEND_COOLDOWN);
    try {
      const { error } =
        method === "email"
          ? await supabase.auth.signInWithOtp({
              email: email!,
              options: {
                shouldCreateUser: true,
                data: { phone_number: phone ?? null },
              },
            })
          : await supabase.auth.signInWithOtp({ phone: phone! });
      if (error) {
        Alert.alert("Error", error.message);
      }
    } catch {
      Alert.alert("Error", "Failed to resend code.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable className="flex-1" onPress={Keyboard.dismiss}>
          <ScrollView
            className="flex-1"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 32 }}
          >
            <View className="px-4 pt-2">
              <Button
                variant="ghost"
                size="icon"
                onPress={() => navigation.goBack()}
              >
                <ChevronLeft color={colors.foreground} size={24} />
              </Button>
            </View>

            <View className="px-8 pt-8">
              <Type variant="display">
                Enter code
              </Type>
              <Type variant="body" tone="muted" className="mt-2">
                Sent to {method === "email" ? email : phone}
              </Type>
              {statusMessage ? (
                <Type variant="caption" tone="muted" className="mt-3">
                  {statusMessage}
                </Type>
              ) : null}
              {errorMessage ? (
                <Type variant="caption" tone="danger" className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3">
                  {errorMessage}
                </Type>
              ) : null}

              <View className="mt-8 gap-6">
                <TextInput
                  ref={inputRef}
                  value={code}
                  onChangeText={(t) => {
                    const digits = t.replace(/\D/g, "").slice(0, CODE_LENGTH);
                    setCode(digits);
                    if (digits.length === CODE_LENGTH) {
                      setTimeout(() => Keyboard.dismiss(), 50);
                    }
                  }}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  maxLength={CODE_LENGTH}
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={handleVerify}
                  placeholder="123456"
                  placeholderTextColor={colors.mutedForeground}
                  className="h-16 rounded-2xl border border-input bg-background px-4 text-center text-3xl font-black tracking-[8px] text-foreground"
                />

                <View className="items-center">
                  {resendTimer > 0 ? (
                    <Type variant="caption" tone="muted">
                      Resend code in {resendTimer}s
                    </Type>
                  ) : (
                    <Button variant="ghost" onPress={handleResend}>
                      Resend Code
                    </Button>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          <View className="border-t border-border bg-background px-8 pb-6 pt-3">
            <Button
              size="lg"
              onPress={handleVerify}
              disabled={loading || code.length !== CODE_LENGTH}
            >
              {loading ? "Verifying..." : "Verify"}
            </Button>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function ensureProfile(
  userId: string,
  auth: { phone?: string; email?: string; method: "email" | "sms" },
) {
  // Check if profile exists
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    // Create new profile
    await supabase.from("profiles").insert({
      user_id: userId,
      phone_number: auth.phone ?? null,
      signup_method: auth.method === "email" ? "email" : "phone",
      onboarding_completed: false,
    });
  }

  // Check admin status
  if (env.adminPhoneNumber && auth.phone === env.adminPhoneNumber) {
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
