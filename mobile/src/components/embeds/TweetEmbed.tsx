import { useState, useCallback } from "react";
import { View, Dimensions } from "react-native";
import { WebView } from "react-native-webview";

const SCREEN_WIDTH = Dimensions.get("window").width;

/**
 * Extract tweet ID from an embed_code or URL string.
 */
export function parseTweetId(input: string): string | null {
  if (!input) return null;
  const match = input.match(
    /(?:https?:\/\/)?(?:www\.)?(?:twitter\.com|x\.com)\/\w+\/status(?:es)?\/(\d+)/i,
  );
  return match?.[1] ?? null;
}

function buildTweetHtml(tweetId: string, width: number): string {
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: transparent; overflow: hidden; }
  .container { display: flex; justify-content: center; padding: 0; }
  .twitter-tweet { margin: 0 !important; }
</style>
</head><body>
<div class="container" id="tweet-container">
  <blockquote class="twitter-tweet" data-theme="dark" data-width="${width}">
    <a href="https://twitter.com/x/status/${tweetId}"></a>
  </blockquote>
</div>
<script async src="https://platform.twitter.com/widgets.js" onload="
  twttr.ready(function(twttr) {
    twttr.events.bind('rendered', function() {
      setTimeout(function() {
        var h = document.getElementById('tweet-container').scrollHeight;
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'resize',height:h}));
      }, 300);
    });
  });
"></script>
<script>
  setTimeout(function() {
    var h = document.getElementById('tweet-container').scrollHeight;
    if (h > 50) window.ReactNativeWebView.postMessage(JSON.stringify({type:'resize',height:h}));
  }, 4000);
</script>
</body></html>`;
}

const ALLOWED_PREFIXES = [
  "https://platform.twitter.com",
  "https://syndication.twitter.com",
  "https://cdn.syndication.twimg.com",
  "https://pbs.twimg.com",
  "https://video.twimg.com",
  "https://abs.twimg.com",
  "about:",
  "data:",
];

type Props = {
  tweetId: string;
  width?: number;
};

export function TweetEmbed({ tweetId, width }: Props) {
  const effectiveWidth = width ?? Math.round(SCREEN_WIDTH - 48);
  const [height, setHeight] = useState(320);

  const onMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "resize" && data.height > 50) {
        setHeight(data.height);
      }
    } catch {}
  }, []);

  return (
    <View
      className="overflow-hidden rounded-xl"
      style={{ height, backgroundColor: "#15202b" }}
    >
      <WebView
        source={{ html: buildTweetHtml(tweetId, effectiveWidth) }}
        style={{ backgroundColor: "transparent" }}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        originWhitelist={["*"]}
        onShouldStartLoadWithRequest={(req) =>
          ALLOWED_PREFIXES.some((p) => req.url.startsWith(p))
        }
      />
    </View>
  );
}
