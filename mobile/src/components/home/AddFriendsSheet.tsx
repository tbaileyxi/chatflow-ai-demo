// The ＋ on the Friends row.
//
// The room's avatar strip has had a ＋ Add sitting in it the whole time; Home's
// had nothing but the word "Invite" in the section header, which reads as a
// label rather than a button. Same gesture, same place, both screens.
//
// It is NOT the room sheet. There is no room here to pull anyone into, so the
// two things it can actually do are hand somebody a link and look at your
// contacts again.

import { Modal, Pressable, View } from "react-native";
import { Link2, RefreshCw, Search, X } from "lucide-react-native";
import { Type } from "@/components/ui/Type";
import { colors } from "@/theme/colors";

type Props = {
  visible: boolean;
  onClose: () => void;
  onShareLink: () => void;
  // Contacts already granted → re-run the sweep now. Not granted → ask.
  granted: boolean | null;
  onRescan: () => void;
  onFindFriends: () => void;
  scanning: boolean;
};

export function AddFriendsSheet({
  visible, onClose, onShareLink, granted, onRescan, onFindFriends, scanning,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60" onPress={onClose}>
        <View className="flex-1 justify-end">
          <View
            onStartShouldSetResponder={() => true}
            className="rounded-t-3xl border-t border-border bg-background px-5 pb-10 pt-4"
          >
            <View className="mb-4 flex-row items-center">
              <View className="flex-1 items-center">
                <View className="h-1.5 w-12 rounded-full bg-muted" />
              </View>
              <Pressable onPress={onClose} hitSlop={8}>
                <X color={colors.mutedForeground} size={22} />
              </Pressable>
            </View>

            <Type variant="title" className="mb-1">Add friends</Type>
            <Type variant="caption" tone="muted" className="mb-4 leading-5">
              Send someone a link, or check whether anyone from your contacts has
              turned up since last time.
            </Type>

            <Pressable
              onPress={() => { onClose(); onShareLink(); }}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 active:opacity-80"
            >
              <Link2 color={colors.primaryForeground} size={18} />
              <Type variant="heading" tone="onPrimary">Share invite link</Type>
            </Pressable>

            {granted ? (
              <>
                <Pressable
                  onPress={() => { onRescan(); onClose(); }}
                  className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-3.5 active:opacity-70"
                >
                  <RefreshCw color={colors.primary} size={18} />
                  <View className="flex-1">
                    <Type variant="captionStrong">Check contacts again</Type>
                    <Type variant="caption" tone="muted">
                      Runs on its own once a day. This is for when you've just
                      told someone to download it.
                    </Type>
                  </View>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={() => { onClose(); onFindFriends(); }}
                className="flex-row items-center gap-3 rounded-xl border border-border px-4 py-3.5 active:opacity-70"
              >
                <Search color={colors.primary} size={18} />
                <View className="flex-1">
                  <Type variant="captionStrong">
                    {scanning ? "Looking..." : "Find friends you know"}
                  </Type>
                  <Type variant="caption" tone="muted">
                    Your contacts are scrambled on this phone — names and
                    numbers never leave it.
                  </Type>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}
