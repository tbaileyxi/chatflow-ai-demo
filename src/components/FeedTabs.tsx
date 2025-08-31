import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VirtualizedOptimizedSpotlightFeed } from "@/components/optimized/VirtualizedOptimizedSpotlightFeed";
import { VirtualizedOptimizedYourFeed } from "@/components/optimized/VirtualizedOptimizedYourFeed";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const FeedTabs = () => {
  const [activeTab, setActiveTab] = useState<"spotlight" | "your-feed">("spotlight");

  return (
    <div className="flex flex-col h-full">
      {/* Modern Tab Header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-center p-2">
          <div className="flex bg-muted rounded-lg p-1 gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-6 py-2 text-sm font-medium transition-all duration-200 rounded-md relative",
                activeTab === "spotlight"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
              onClick={() => setActiveTab("spotlight")}
            >
              Spotlight
              <div className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-all duration-200",
                activeTab === "spotlight" ? "opacity-100" : "opacity-0"
              )} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "px-6 py-2 text-sm font-medium transition-all duration-200 rounded-md relative flex items-center gap-2",
                activeTab === "your-feed"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              )}
              onClick={() => setActiveTab("your-feed")}
            >
              Your Feed
              <div className={cn(
                "absolute bottom-0 left-0 right-0 h-0.5 bg-primary transition-all duration-200",
                activeTab === "your-feed" ? "opacity-100" : "opacity-0"
              )} />
            </Button>
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0">
        {activeTab === "spotlight" ? (
          <VirtualizedOptimizedSpotlightFeed />
        ) : (
          <VirtualizedOptimizedYourFeed />
        )}
      </div>

    </div>
  );
};