import { useEffect, useRef, useState } from "react";

// Load Twitter/X widgets.js once per app
const loadTwitterWidgets = (): Promise<any> => {
  const w = window as any;
  if (w.twttr?.widgets) return Promise.resolve(w.twttr);
  if (w.__twWidgetsPromise) return w.__twWidgetsPromise as Promise<any>;

  w.__twWidgetsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(
      'script[src*="platform.twitter.com/widgets.js"]'
    ) as HTMLScriptElement | null;

    const finish = () => resolve((window as any).twttr);

    if (existing) {
      existing.addEventListener("load", finish, { once: true });
      existing.addEventListener("error", () => reject(new Error("widgets.js failed")), { once: true });
    } else {
      const s = document.createElement("script");
      s.src = "https://platform.twitter.com/widgets.js";
      s.async = true;
      s.defer = true;
      s.onload = finish;
      s.onerror = () => reject(new Error("widgets.js failed"));
      document.head.appendChild(s);
    }

    // Safety timeout
    setTimeout(() => {
      if ((window as any).twttr) finish();
    }, 8000);
  });

  return w.__twWidgetsPromise as Promise<any>;
};

const extractTweetId = (input: string): string | null => {
  const match = input.match(/status\/(\d+)/);
  return match?.[1] ?? null;
};

interface XPostEmbedProps {
  embedCode: string; // raw embed html or a tweet url
}

export function XPostEmbed({ embedCode }: XPostEmbedProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let ro: ResizeObserver | null = null;

    const mount = async () => {
      const id = extractTweetId(embedCode);
      const el = hostRef.current;
      if (!el || !id) {
        setError("Invalid X post");
        setLoading(false);
        return;
      }

      // Reserve space to avoid layout jumps
      el.style.minHeight = "200px";
      el.innerHTML = "";

      try {
        const tw = await loadTwitterWidgets();
        if (cancelled) return;

        const created = await tw.widgets.createTweet(id, el, {
          dnt: true,
          width: "100%",
          conversation: "none",
          align: "center",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
        });

        setLoading(false);
        el.style.minHeight = "0px";

        // Track size changes to ensure parents recalc height
        if (created) {
          ro = new ResizeObserver(() => {
            if (!el) return;
            // Force layout to pick up height changes
            el.style.height = "auto";
          });
          ro.observe(created as HTMLElement);
        }
      } catch (e) {
        if (!cancelled) {
          setError("Failed to load X post");
          setLoading(false);
        }
      }
    };

    mount();
    return () => {
      cancelled = true;
      ro?.disconnect();
    };
  }, [embedCode]);

  const fallbackUrl = (embedCode.match(/https?:\/\/[^"'\s]+/) || ["#"])[0];

  return (
    <div ref={hostRef} className="x-embed w-full max-w-full" aria-busy={loading}>
      {error && (
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer" className="text-sm underline">
          View on X
        </a>
      )}
    </div>
  );
}
