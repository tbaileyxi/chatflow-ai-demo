import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { colors } from "@/theme/colors";
import type { AuthStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<AuthStackParamList, "PhoneEntry">;

const COUNTRY_CODES = [
  { code: "+1", label: "US +1" },
  { code: "+44", label: "UK +44" },
  { code: "+61", label: "AU +61" },
  { code: "+91", label: "IN +91" },
] as const;

function formatPhoneForSupabase(countryCode: string, phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `${countryCode}${digits}`;
}

export function PhoneEntryScreen() {
  const navigation = useNavigation<Nav>();
  const [countryCode, setCountryCode] = useState("+1");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCodes, setShowCodes] = useState(false);

  const handleSendCode = async () => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      Alert.alert("Invalid Number", "Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      const fullPhone = formatPhoneForSupabase(countryCode, phone);
      console.log("Sending OTP to:", fullPhone);

      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });

      if (error) {
        console.log("OTP send error:", error.message);
        Alert.alert("Error", error.message);
        return;
      }

      console.log("OTP sent successfully, navigating to verification");
      navigation.navigate("OTPVerification", {
        phone: fullPhone,
      });
    } catch {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
          Enter your phone number
        </Text>
        <Text className="mt-2 text-base text-muted-foreground">
          We'll send you a verification code
        </Text>

        <View className="mt-8 gap-4">
          {/* Country code selector */}
          <View className="flex-row gap-3">
            <View className="relative">
              <Button
                variant="outline"
                className="w-24"
                onPress={() => setShowCodes(!showCodes)}
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
                value={phone}
                onChangeText={setPhone}
                autoFocus
              />
            </View>
          </View>

          <Button
            size="lg"
            onPress={handleSendCode}
            disabled={loading || phone.replace(/\D/g, "").length < 10}
          >
            {loading ? "Sending..." : "Send Code"}
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
