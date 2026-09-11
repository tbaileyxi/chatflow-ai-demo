import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Type } from "@/components/ui/Type";
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

// ─── X Post Card (styled text card for Grok-sourced content) ────
function XPostCard({ content }: { content: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="rounded-2xl bg-muted px-4 py-3">
      <View className="mb-1.5 flex-row">
        <View className="rounded-full bg-muted px-2.5 py-0.5 border border-border">
          <Type variant="dataStrong" tone="muted">
            X
          </Type>
        </View>
      </View>
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <Type variant="caption" className="leading-5"
          
          numberOfLines={expanded ? undefined : 4}>
          {content}
        </Type>
        {!expanded && content.length > 200 && (
          <Type variant="captionStrong" tone="primary" className="mt-1">
            Read more
          </Type>
        )}
      </Pressable>
    </View>
  );
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
            <Type variant="dataStrong"
              
              style={{ color: "#FF6B35" }}>
              r/{subreddit}
            </Type>
          </View>
        </View>
      )}
      <Pressable onPress={() => setExpanded((e) => !e)}>
        <Type variant="caption" className="leading-5"
          
          numberOfLines={expanded ? undefined : 3}>
          {content}
        </Type>
        {!expanded && content.length > 150 && (
          <Type variant="captionStrong" tone="primary" className="mt-1">
            Read more
          </Type>
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

  // Check if embed_code is a real tweet URL/ID (from team_trending) vs a hash (from pulse-drop)
  const tweetId = message.embedCode ? parseTweetId(message.embedCode) : null;
  const subreddit = parseSubreddit(message.embedCode, message.content);

  // Real tweet embed (from team_trending with actual tweet URLs)
  if (isX && tweetId) {
    return <TweetEmbed tweetId={tweetId} />;
  }

  // X content from Grok (pulse-drop) — styled text card
  if (isX) {
    return <XPostCard content={message.content} />;
  }

  // Reddit content
  if (isReddit) {
    return <RedditPostCard content={message.content} subreddit={subreddit} />;
  }

  // Fallback: plain content card
  return (
    <View className="rounded-2xl bg-muted px-4 py-2.5">
      <Type variant="caption" className="leading-5">
        {message.content}
      </Type>
    </View>
  );
}
