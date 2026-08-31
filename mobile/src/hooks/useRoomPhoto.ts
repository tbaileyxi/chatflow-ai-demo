// Set the picture that sits behind a room's chat.
//
// Every Browns room in the country renders the same team logo, so nothing in
// the app belongs to the person who runs it. A photo of their bar, their
// tailgate, their chapter banner is what makes a room theirs — and it is the
// face of the share card the room produces for each game.
//
// One hook, three call sites: onboarding, the room's own settings, and profile.
//
// Storage layout is `<huddle_id>/<file>` because the bucket policy reads the
// first path segment to decide whether you run this room (see
// can_set_room_photo in RUN_THIS_ROOM_PHOTOS.sql). Uploading anywhere else is
// rejected, which is what stops a member redecorating someone else's room.

import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
// `supabase as any` on the writes: photo_url is newer than the generated
// Database types, the same lag useHuddleDetails works around on the read side.
import { supabase } from "@/integrations/supabase/client";

function base64ToUint8Array(base64: string) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = base64.replace(/[^A-Za-z0-9+/]/g, "");
  const bytes = new Uint8Array((clean.length * 3) / 4);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n =
      (chars.indexOf(clean[i]) << 18) |
      (chars.indexOf(clean[i + 1]) << 12) |
      (chars.indexOf(clean[i + 2]) << 6) |
      chars.indexOf(clean[i + 3]);
    bytes[p++] = (n >> 16) & 255;
    if (clean[i + 2] !== "=") bytes[p++] = (n >> 8) & 255;
    if (clean[i + 3] !== "=") bytes[p++] = n & 255;
  }
  return bytes.subarray(0, p);
}

export function useRoomPhoto(huddleId: string | null | undefined) {
  const [uploading, setUploading] = useState(false);

  /** Opens the picker, uploads, and points the room at the result. */
  const pick = async (): Promise<{ ok: boolean; url?: string }> => {
    if (!huddleId) return { ok: false };

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Photo access needed",
        "Allow photo access to set a picture for this room.",
      );
      return { ok: false };
    }

    // Portrait crop, because it sits behind a full-height chat rather than in a
    // circle. 9:16 is what the share card wants later too.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return { ok: false };

    setUploading(true);
    try {
      const asset = result.assets[0];
      const base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: "base64",
      });
      const rawExt = asset.uri.split(".").pop()?.toLowerCase()?.split("?")[0];
      const png = rawExt === "png";
      const path = `${huddleId}/room-${Date.now()}.${png ? "png" : "jpg"}`;

      const { error: upErr } = await supabase.storage
        .from("room-photos")
        .upload(path, base64ToUint8Array(base64), {
          contentType: png ? "image/png" : "image/jpeg",
          upsert: true,
        });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("room-photos").getPublicUrl(path);
      const { error: rowErr } = await (supabase as any)
        .from("huddles")
        .update({ photo_url: data.publicUrl })
        .eq("id", huddleId);
      if (rowErr) throw rowErr;

      return { ok: true, url: data.publicUrl };
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      Alert.alert(
        "Couldn't set the photo",
        // The two failures worth naming, because the generic text sends people
        // hunting in the wrong place.
        msg.includes("Bucket not found")
          ? "The room-photos bucket hasn't been created yet."
          : msg.toLowerCase().includes("row-level security") ||
              msg.includes("Unauthorized")
            ? "Only the room's owner or an admin can change its photo."
            : msg || "Please try again.",
      );
      return { ok: false };
    } finally {
      setUploading(false);
    }
  };

  const clear = async (): Promise<boolean> => {
    if (!huddleId) return false;
    const { error } = await (supabase as any)
      .from("huddles")
      .update({ photo_url: null })
      .eq("id", huddleId);
    if (error) {
      Alert.alert("Couldn't remove the photo", error.message);
      return false;
    }
    return true;
  };

  return { pick, clear, uploading };
}
