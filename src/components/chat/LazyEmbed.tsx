import { useEffect, useRef, useState } from "react";

interface LazyEmbedProps {
  children: React.ReactNode;
  placeholder?: React.ReactNode;
}

export function LazyEmbed({ children, placeholder }: LazyEmbedProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current || visible) return;
    const el = ref.current;
    const obs = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [visible]);

  return (
    <div ref={ref} className="w-full">
      {visible ? (
        children
      ) : (
        placeholder || (
          <div className="aspect-video w-full rounded-md bg-muted/60 border border-border flex items-center justify-center text-muted-foreground text-sm">
            Embed will load when visible
          </div>
        )
      )}
    </div>
  );
}
