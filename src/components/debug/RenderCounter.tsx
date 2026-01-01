import React, { useRef, useEffect } from 'react';

interface RenderCounterProps {
  name: string;
}

// Create a shared store for render counts
const renderCounts: Record<string, number> = {};

export function useRenderCount(name: string): number {
  const countRef = useRef(0);
  
  useEffect(() => {
    countRef.current++;
    renderCounts[name] = countRef.current;
  });
  
  return countRef.current;
}

export function RenderCounterOverlay() {
  // Force re-render every second to show latest counts
  const [, forceUpdate] = React.useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="fixed bottom-24 left-2 z-[9999] bg-black/80 text-[10px] font-mono text-green-400 px-2 py-1 rounded pointer-events-none">
      <div>ROOM: {renderCounts['room'] || 0}</div>
      <div>PULSE: {renderCounts['pulse'] || 0}</div>
      <div>CHAT: {renderCounts['chat'] || 0}</div>
    </div>
  );
}
