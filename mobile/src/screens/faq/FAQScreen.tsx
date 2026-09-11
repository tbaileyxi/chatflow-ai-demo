import { View, Text, Pressable, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { ChevronLeft, HelpCircle, Mail, ExternalLink } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { colors } from "@/theme/colors";

const FAQ_URL = "https://sidehuddlefounders.carrd.co/#faqs";
const CONTACT_URL = "https://sidehuddlefounders.carrd.co/#contactus";

export function FAQScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="flex-row items-center gap-3 px-4 py-3">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8}>
          <ChevronLeft color={colors.foreground} size={24} />
        </Pressable>
        <Type variant="heading" className="flex-1">
          FAQ
        </Type>
      </View>

      <View className="gap-4 px-4 pt-4">
        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <HelpCircle color={colors.primary} size={20} />
              <CardTitle>Need Help?</CardTitle>
            </View>
            <CardDescription>
              Check out our frequently asked questions for answers to common
              questions about Side Huddle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onPress={() => Linking.openURL(FAQ_URL)}
            >
              <View className="flex-row items-center gap-2">
                <ExternalLink color={colors.foreground} size={14} />
                <Type variant="captionStrong">
                  View FAQs
                </Type>
              </View>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <View className="flex-row items-center gap-2">
              <Mail color={colors.secondary} size={20} />
              <CardTitle>Still have questions?</CardTitle>
            </View>
            <CardDescription>
              Reach out to our team and we'll get back to you as soon as
              possible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onPress={() => Linking.openURL(CONTACT_URL)}
            >
              <View className="flex-row items-center gap-2">
                <ExternalLink color={colors.foreground} size={14} />
                <Type variant="captionStrong">
                  Contact Us
                </Type>
              </View>
            </Button>
          </CardContent>
        </Card>
      </View>
    </SafeAreaView>
  );
}
