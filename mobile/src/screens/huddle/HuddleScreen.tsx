import { useEffect, useRef } from "react";
import { View, FlatList, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAuth } from "@/hooks/useAuth";
import { useHuddleDetails } from "@/hooks/useHuddleDetails";
import { useHuddleMessages, type HuddleMessage } from "@/hooks/useHuddleMessages";
import { HuddleHeader } from "@/components/huddle/HuddleHeader";
import { ChatMessage } from "@/components/huddle/ChatMessage";
import { MessageInput } from "@/components/huddle/MessageInput";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { supabase } from "@/integrations/supabase/client";
import type { RootStackParamList } from "@/navigation/types";

type Route = RouteProp<RootStackParamList, "Huddle">;

export function HuddleScreen() {
  const route = useRoute<Route>();
  const { huddleId } = route.params;
  const { user } = useAuth();
  const { data: huddle, isLoading: huddleLoading } = useHuddleDetails(huddleId);
  const { data: messages, isLoading: messagesLoading, sendMessage } =
    useHuddleMessages(huddleId);
  const flatListRef = useRef<FlatList<HuddleMessage>>(null);

  // Update last_read_at on mount and when new messages arrive
  useEffect(() => {
    if (!user || !huddleId) return;
    supabase
      .from("huddle_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("huddle_id", huddleId)
      .eq("user_id", user.id)
      .then(() => {});
  }, [user, huddleId, messages?.length]);

  if (huddleLoading || !huddle) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingSpinner className="flex-1" />
      </SafeAreaView>
    );
  }

  const handleSend = async (content: string) => {
    if (!user) return { error: new Error("Not authenticated") };
    return sendMessage(content, user.id);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <HuddleHeader huddle={huddle} />

        {messagesLoading ? (
          <LoadingSpinner className="flex-1" />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ChatMessage
                message={item}
                isOwnMessage={item.userId === user?.id}
              />
            )}
            inverted
            contentContainerStyle={{ paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {user && huddle.isMember && (
          <MessageInput onSend={handleSend} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
