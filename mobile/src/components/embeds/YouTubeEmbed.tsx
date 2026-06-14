import { useState } from "react";
import { View, Pressable, Image, Dimensions } from "react-native";
import { WebView } from "react-native-webview";
import { Play } from "lucide-react-native";
import { colors } from "@/theme/colors";

const SCREEN_WIDTH = Dimensions.get("window").width;

// Pull a YouTube video id out of an embed_code iframe, a watch URL, an embed
// URL, or a youtu.be link.
export function parseYouTubeId(input: string): string | null {
  if (!input) return null;
  const m = input.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  );
  return m?.[1] ?? null;
}

type Props = {
  videoId: string;
  width?: number;
};

// Tap the poster → swaps in an inline player that plays IN the app (no jump to
// the YouTube app/browser). 16:9.
export function YouTubeEmbed({ videoId, width }: Props) {
  const w = width ?? Math.round(SCREEN_WIDTH - 80);
  const h = Math.round((w * 9) / 16);
  const [playing, setPlaying] = useState(false);

  if (playing) {
    const src = `https://www.youtube.com/embed/${videoId}?playsinline=1&autoplay=1&modestbranding=1&rel=0`;
    return (
      <View
        className="mt-1 overflow-hidden rounded-xl"
        style={{ width: w, height: h, backgroundColor: "#000" }}
      >
        <WebView
          source={{ uri: src }}
          style={{ backgroundColor: "#000" }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsFullscreenVideo
          originWhitelist={["*"]}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setPlaying(true)}
      className="mt-1 overflow-hidden rounded-xl"
      style={{ width: w, height: h, backgroundColor: "#000" }}
    >
      <Image
        source={{ uri: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }}
        style={{ width: w, height: h }}
        resizeMode="cover"
      />
      <View className="absolute inset-0 items-center justify-center">
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 56,
            height: 56,
            backgroundColor: "rgba(0,0,0,0.6)",
            borderWidth: 2,
            borderColor: colors.primary,
          }}
        >
          <Play color={colors.primary} size={26} style={{ marginLeft: 3 }} fill={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}
