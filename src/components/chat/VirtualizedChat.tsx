import React, { useMemo } from "react";
import { Virtuoso } from "react-virtuoso";

interface VirtualizedChatProps<T> {
  items: T[];
  loadMoreTop?: () => Promise<void> | void;
  itemContent: (index: number, item: T) => React.ReactNode;
}

export function VirtualizedChat<T>({ items, loadMoreTop, itemContent }: VirtualizedChatProps<T>) {
  const data = useMemo(() => items, [items]);

  return (
    <div className="flex-1 min-h-0">
      <Virtuoso
        style={{ height: "100%" }}
        data={data}
        itemContent={(index, item) => itemContent(index, item)}
        startReached={async () => {
          if (loadMoreTop) await loadMoreTop();
        }}
        followOutput="auto"
        overscan={300}
      />
    </div>
  );
}
