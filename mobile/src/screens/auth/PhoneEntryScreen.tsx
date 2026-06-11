import { useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/theme/colors";
import { formatPhoneForAuth } from "@/config/testLogins";
import type { AuthStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList, "PhoneEntry">;

const COUNTRY_CODES = [
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+91", label: "IN +91" },
] as const;

export function PhoneEntryScreen() {
  const navigation = useNavigation<Nav>();
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState<"email" | "sms">("email");
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  const handleSendCode = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (authMethod === "email" && !trimmedEmail.includes("@")) {
      Alert.alert("Invalid Email", "Enter a valid email address.");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (authMethod === "sms" && digits.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const fullPhone = formatPhoneForAuth(countryCode, phone);
      console.log("Sending OTP to:", fullPhone);

      if (authMethod === "email") {
        const { error } = await supabase.auth.signInWithOtp({
          email: trimmedEmail,
          options: {
            shouldCreateUser: true,
            data: {
              phone_number: digits.length >= 10 ? fullPhone : null,
            },
          },
        });

        if (error) {
          console.log("Email OTP send error:", error.message);
          Alert.alert("Error", error.message);
          return;
        }

        navigation.navigate("OTPVerification", {
          email: trimmedEmail,
          phone: digits.length >= 10 ? fullPhone : undefined,
          method: "email",
        });
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });

      if (error) {
        console.log("OTP send error:", error.message);
        Alert.alert("Error", error.message);
        return;
      }

      console.log("OTP sent successfully, navigating to verification");
      navigation.navigate("OTPVerification", {
        phone: fullPhone,
        method: "sms",
      });
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
              <Text className="text-3xl font-black text-foreground">
                Sign in
              </Text>
              <Text className="mt-2 text-base leading-6 text-muted-foreground">
                Use an email code to sign in. Phone can stay on your profile
                until SMS is ready.
              </Text>

              <View className="mt-6 flex-row rounded-xl border border-border bg-muted p-1">
                <Button
                  variant={authMethod === "email" ? "default" : "ghost"}
                  className="flex-1"
                  onPress={() => {
                    Keyboard.dismiss();
                    setAuthMethod("email");
                  }}
                >
                  Email Code
                </Button>
                <Button
                  variant={authMethod === "sms" ? "default" : "ghost"}
                  className="flex-1"
                  onPress={() => {
                    Keyboard.dismiss();
                    setAuthMethod("sms");
                  }}
                >
                  SMS Code
                </Button>
              </View>

              <View className="mt-6 gap-4">
                {authMethod === "email" && (
                  <Input
                    placeholder="you@example.com"
                    keyboardType="email-address"
                    textContentType="emailAddress"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus={false}
                    returnKeyType="send"
                    blurOnSubmit
                    onSubmitEditing={handleSendCode}
                  />
                )}

                {authMethod === "sms" ? (
                  <View className="gap-4">
                    <View className="flex-row gap-3">
                      <View className="relative">
                        <Button
                          variant="outline"
                          className="w-24"
                          onPress={() => {
                            Keyboard.dismiss();
                            setShowCodes(!showCodes);
                          }}
                        >
                          {COUNTRY_CODES.find((c) => c.code === countryCode)?.label ??
                            countryCode}
                        </Button>
                        {showCodes && (
                          <View className="absolute left-0 top-12 z-10 w-32 rounded-md border border-border bg-popover p-1">
                            {COUNTRY_CODES.map((c) => (
                              <Button
                                key={c.code}
                                variant="ghost"
                                className="justify-start"
                                onPress={() => {
                                  setCountryCode(c.code);
                                  setShowCodes(false);
                                }}
                              >
                                {c.label}
                              </Button>
                            ))}
                          </View>
                        )}
                      </View>

                      <View className="flex-1">
                        <Input
                          placeholder="(555) 123-4567"
                          keyboardType="phone-pad"
                          textContentType="telephoneNumber"
                          value={phone}
                          onChangeText={setPhone}
                          autoFocus={false}
                          returnKeyType="done"
                        />
                      </View>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          </ScrollView>

          <View className="border-t border-border bg-background px-8 pb-6 pt-3">
            <Button
              size="lg"
              onPress={handleSendCode}
              disabled={
                loading ||
                (authMethod === "email"
                  ? !email.trim().includes("@")
                  : phone.replace(/\D/g, "").length < 10)
              }
            >
              {loading
                ? "Sending..."
                : authMethod === "email"
                  ? "Send Email Code"
                  : "Send SMS Code"}
            </Button>
          </View>
        </Pressable>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
