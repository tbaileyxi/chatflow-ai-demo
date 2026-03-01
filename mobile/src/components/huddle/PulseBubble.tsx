import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Zap } from "lucide-react-native";
import { TweetEmbed, parseTweetId } from "@/components/embeds/TweetEmbed";
import type { HuddleMessage } from "@/hooks/useHuddleMessages";

/**
 * Extract subreddit name from embed_code or content
 */
function parseSubreddit(
  embedCode: string | null,
  content: string,
): string | null {
  const src = embedCode ?? content;
  const match = src.match(/r\/([a-zA-Z0-9_]+)/i);
  return match?.[1] ?? null;
}

// ─── Reddit Post Card ─────────────────────────────────────────
function RedditPostCard({
  content,
  subreddit,
}: {
  content: string;
  subreddit: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="rounded-2xl bg-muted px-4 py-3">
      {subreddit && (
        <View className="mb-1.5 flex-row">
          <View className="rounded-full bg-orange-500/15 px-2.5 py-0.5">
            <Text
              className="text-[11px] font-semibold"
              style={{ color: "#FF6B35" }}
            >
              r/{subreddit}
            </Text>
          </View>
        </View>
      )}
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <Text
          className="text-sm leading-5 text-foreground"
          numberOfLines={expanded ? undefined : 3}
        >
          {content}
        </Text>
        {!expanded && content.length > 150 && (
          <Text className="mt-1 text-xs font-medium text-primary">
            Read more
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ─── PulseBubble Main Component ───────────────────────────────
type Props = {
  message: HuddleMessage;
};

export function PulseBubble({ message }: Props) {
  const isX = message.pulseSource === "x" || message.messageType === "x_post";
  const isReddit = message.pulseSource === "reddit";
  const tweetId = message.embedCode ? parseTweetId(message.embedCode) : null;
  const subreddit = parseSubreddit(message.embedCode, message.content);

  return (
    <View className="my-0.5">
      {/* Pulse badge */}
      <View className="mb-1 flex-row items-center gap-1.5">
        <Zap color="#EAB308" size={12} fill="#EAB308" />
        <Text
          className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: "#EAB308" }}
        >
          Pulse
        </Text>
        {isX && (
          <View className="rounded-full bg-muted px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-muted-foreground">
              X
            </Text>
          </View>
        )}
        {isReddit && subreddit && (
          <View className="rounded-full bg-orange-500/15 px-2 py-0.5">
            <Text
              className="text-[10px] font-semibold"
              style={{ color: "#FF6B35" }}
            >
              r/{subreddit}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      {isX && tweetId ? (
        <TweetEmbed tweetId={tweetId} />
      ) : isReddit ? (
        <RedditPostCard content={message.content} subreddit={subreddit} />
      ) : (
        <View className="rounded-2xl bg-muted px-4 py-2.5">
          <Text className="text-sm leading-5 text-foreground">
            {message.content}
          </Text>
        </View>
      )}
    </View>
  );
}
