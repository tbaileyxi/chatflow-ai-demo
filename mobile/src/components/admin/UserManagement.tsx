import { useState } from "react";
import { View, Text, Image, Alert, FlatList } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Ban, ShieldCheck, ShieldOff, Crown } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { colors } from "@/theme/colors";

type AdminUser = {
  userId: string;
  displayName: string | null;
  username: string | null;
  avatarUrl: string | null;
  phoneNumber: string | null;
  status: string | null;
  role: string | null;
};

function useAdminUsers(search: string) {
  return useQuery({
    queryKey: ["admin-users", search],
    queryFn: async (): Promise<AdminUser[]> => {
      let query = supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, phone_number, status")
        .order("created_at", { ascending: false })
        .limit(50);

      if (search.trim()) {
        query = query.or(
          `display_name.ilike.%${search}%,username.ilike.%${search}%,phone_number.ilike.%${search}%`,
        );
      }

      const { data: profiles, error } = await query;
      if (error || !profiles) return [];

      // Fetch roles
      const userIds = profiles.map((p) => p.user_id);
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role]));

      return profiles.map((p) => ({
        userId: p.user_id,
        displayName: p.display_name,
        username: p.username,
        avatarUrl: p.avatar_url,
        phoneNumber: p.phone_number,
        status: p.status,
        role: roleMap.get(p.user_id) ?? "member",
      }));
    },
  });
}

export function UserManagement() {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { data: users, isLoading } = useAdminUsers(search);

  const updateStatus = (user: AdminUser, newStatus: string) => {
    const label = newStatus === "banned" ? "Ban" : newStatus === "blocked" ? "Block" : "Activate";
    Alert.alert(
      `${label} User`,
      `${label} ${user.displayName ?? user.username ?? "this user"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: label,
          style: newStatus === "active" ? "default" : "destructive",
          onPress: async () => {
            const updates: Record<string, any> = { status: newStatus };
            if (newStatus === "banned") {
              updates.banned_at = new Date().toISOString();
            } else if (newStatus === "blocked") {
              updates.blocked_at = new Date().toISOString();
            }
            await supabase
              .from("profiles")
              .update(updates)
              .eq("user_id", user.userId);
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          },
        },
      ],
    );
  };

  const setRole = (user: AdminUser, newRole: string) => {
    Alert.alert(
      "Change Role",
      `Set ${user.displayName ?? user.username ?? "user"} to ${newRole}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            await supabase
              .from("user_roles")
              .upsert(
                { user_id: user.userId, role: newRole as any },
                { onConflict: "user_id" },
              );
            queryClient.invalidateQueries({ queryKey: ["admin-users"] });
          },
        },
      ],
    );
  };

  const renderUser = ({ item }: { item: AdminUser }) => {
    const name = item.displayName ?? item.username ?? "Unknown";
    const initial = name.charAt(0).toUpperCase();
    const isBanned = item.status === "banned";
    const isBlocked = item.status === "blocked";

    return (
      <View className="gap-3 rounded-lg border border-border bg-card p-3">
        <View className="flex-row items-center gap-3">
          <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted">
            {item.avatarUrl ? (
              <Image source={{ uri: item.avatarUrl }} className="h-full w-full" />
            ) : (
              <Type variant="captionStrong" tone="muted">
                {initial}
              </Type>
            )}
          </View>
          <View className="flex-1 gap-0.5">
            <View className="flex-row items-center gap-2">
              <Type variant="captionStrong"  numberOfLines={1}>
                {name}
              </Type>
              <RoleBadge role={item.role} />
            </View>
            {item.phoneNumber && (
              <Type variant="caption" tone="muted">
                {item.phoneNumber}
              </Type>
            )}
          </View>
          {(isBanned || isBlocked) && (
            <Badge variant="destructive">
              {isBanned ? "Banned" : "Blocked"}
            </Badge>
          )}
        </View>

        {/* Actions */}
        <View className="flex-row flex-wrap gap-2">
          {isBanned || isBlocked ? (
            <Button
              variant="outline"
              size="xs"
              onPress={() => updateStatus(item, "active")}
            >
              <View className="flex-row items-center gap-1">
                <ShieldCheck color={colors.success} size={12} />
                <Type variant="caption">Activate</Type>
              </View>
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                size="xs"
                onPress={() => updateStatus(item, "blocked")}
              >
                <View className="flex-row items-center gap-1">
                  <ShieldOff color={colors.accent} size={12} />
                  <Type variant="caption">Block</Type>
                </View>
              </Button>
              <Button
                variant="outline"
                size="xs"
                onPress={() => updateStatus(item, "banned")}
              >
                <View className="flex-row items-center gap-1">
                  <Ban color={colors.destructive} size={12} />
                  <Type variant="caption">Ban</Type>
                </View>
              </Button>
            </>
          )}
          {item.role !== "admin" && (
            <Button
              variant="outline"
              size="xs"
              onPress={() => setRole(item, "admin")}
            >
              <View className="flex-row items-center gap-1">
                <Crown color={colors.primary} size={12} />
                <Type variant="caption">Make Admin</Type>
              </View>
            </Button>
          )}
          {item.role !== "content_admin" && (
            <Button
              variant="outline"
              size="xs"
              onPress={() => setRole(item, "content_admin")}
            >
              <Type variant="caption">Content Admin</Type>
            </Button>
          )}
          {item.role !== "member" && (
            <Button
              variant="outline"
              size="xs"
              onPress={() => setRole(item, "member")}
            >
              <Type variant="caption">Reset to Member</Type>
            </Button>
          )}
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 gap-3">
      <Input
        placeholder="Search by name, username, or phone..."
        value={search}
        onChangeText={setSearch}
      />

      {isLoading ? (
        <View className="gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.userId}
          renderItem={renderUser}
          contentContainerStyle={{ gap: 12 }}
          ListEmptyComponent={
            <Type variant="body" tone="muted" className="py-8 text-center">
              No users found
            </Type>
          }
        />
      )}
    </View>
  );
}

function RoleBadge({ role }: { role: string | null }) {
  if (!role || role === "member") return null;
  const variant =
    role === "admin"
      ? ("default" as const)
      : ("secondary" as const);
  return <Badge variant={variant}>{role}</Badge>;
}
