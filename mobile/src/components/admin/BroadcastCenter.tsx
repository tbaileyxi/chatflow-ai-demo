import { useState, useEffect } from "react";
import { View, Text, Pressable, Alert, ScrollView } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { Send, CheckSquare, Square } from "lucide-react-native";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { colors } from "@/theme/colors";

type Team = {
  id: string;
  name: string;
  city: string;
};

function useTeams() {
  return useQuery({
    queryKey: ["admin-teams"],
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase
        .from("teams")
        .select("id, name, city")
        .eq("status", "active")
        .order("name");
      if (error || !data) return [];
      return data;
    },
  });
}

export function BroadcastCenter() {
  const { user } = useAuth();
  const { data: teams, isLoading } = useTeams();
  const [content, setContent] = useState("");
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(0);

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!teams) return;
    if (selectedTeams.size === teams.length) {
      setSelectedTeams(new Set());
    } else {
      setSelectedTeams(new Set(teams.map((t) => t.id)));
    }
  };

  const broadcast = async () => {
    if (!content.trim() || selectedTeams.size === 0 || !user) return;

    setSending(true);
    setSent(0);

    try {
      // Get huddles for selected teams
      const { data: huddles } = await supabase
        .from("huddles")
        .select("id, team_id")
        .eq("is_official_team_huddle", true)
        .in("team_id", [...selectedTeams]);

      if (!huddles || huddles.length === 0) {
        Alert.alert("No Huddles", "No official huddles found for selected teams.");
        setSending(false);
        return;
      }

      // Send message to each huddle
      const messages = huddles.map((h) => ({
        huddle_id: h.id,
        user_id: user.id,
        content: content.trim(),
        is_bot_message: true,
      }));

      const { error } = await supabase.from("huddle_messages").insert(messages);

      if (error) {
        Alert.alert("Error", "Failed to broadcast messages.");
      } else {
        setSent(huddles.length);
        Alert.alert(
          "Broadcast Sent",
          `Message sent to ${huddles.length} huddle${huddles.length > 1 ? "s" : ""}.`,
        );
        setContent("");
        setSelectedTeams(new Set());
      }
    } catch {
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setSending(false);
    }
  };

  if (isLoading) {
    return (
      <View className="gap-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </View>
    );
  }

  return (
    <View className="gap-4">
      {/* Message */}
      <View className="gap-2">
        <Text className="text-sm font-semibold text-foreground">Message</Text>
        <Textarea
          value={content}
          onChangeText={setContent}
          placeholder="Type your broadcast message..."
          numberOfLines={4}
        />
      </View>

      {/* Team selector */}
      <View className="gap-2">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm font-semibold text-foreground">
            Destination Teams ({selectedTeams.size})
          </Text>
          <Button variant="ghost" size="xs" onPress={selectAll}>
            {selectedTeams.size === teams?.length ? "Deselect All" : "Select All"}
          </Button>
        </View>

        <ScrollView className="max-h-64" nestedScrollEnabled>
          <View className="gap-1">
            {teams?.map((team) => {
              const selected = selectedTeams.has(team.id);
              return (
                <Pressable
                  key={team.id}
                  className={cn(
                    "flex-row items-center gap-3 rounded-md px-3 py-2",
                    selected ? "bg-primary/10" : "bg-transparent",
                  )}
                  onPress={() => toggleTeam(team.id)}
                >
                  {selected ? (
                    <CheckSquare color={colors.primary} size={18} />
                  ) : (
                    <Square color={colors.mutedForeground} size={18} />
                  )}
                  <Text
                    className={cn(
                      "text-sm",
                      selected
                        ? "font-medium text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {team.city} {team.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Send */}
      <Button
        size="lg"
        onPress={broadcast}
        disabled={sending || !content.trim() || selectedTeams.size === 0}
      >
        <View className="flex-row items-center gap-2">
          <Send color={colors.primaryForeground} size={16} />
          <Text className="text-sm font-semibold text-primary-foreground">
            {sending ? "Sending..." : `Broadcast to ${selectedTeams.size} Team${selectedTeams.size !== 1 ? "s" : ""}`}
          </Text>
        </View>
      </Button>
    </View>
  );
}
