import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YourFeed } from "@/components/YourFeed";
import { EnhancedSpotlightFeed } from "@/components/EnhancedSpotlightFeed";
import { useIsMobile } from "@/hooks/use-mobile";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const FeedTabs = () => {
  const [activeTab, setActiveTab] = useState("spotlight");
  const isMobile = useIsMobile();

  return (
    <div className="flex-1 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="flex w-full p-4 bg-gradient-to-r from-background to-muted/30 border-b border-border">
          <div className="flex space-x-2 mx-auto glassmorphism rounded-full p-1 shadow-lg">
            <button
              onClick={() => setActiveTab("spotlight")}
              className={`px-6 py-3 rounded-full text-lg font-semibold transition-all duration-300 ${
                activeTab === "spotlight"
                  ? "bg-primary text-primary-foreground shadow-lg transform scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              Spotlight
            </button>
            <button
              onClick={() => setActiveTab("your-feed")}
              className={`px-6 py-3 rounded-full text-lg font-semibold transition-all duration-300 flex items-center gap-2 ${
                activeTab === "your-feed"
                  ? "bg-secondary text-secondary-foreground shadow-lg transform scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/50"
              }`}
            >
              Your Feed
              {activeTab === "your-feed" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 ml-1 hover:bg-white/20 rounded-full"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = '/teams';
                  }}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              )}
            </button>
          </div>
        </div>
        <div className="flex-1 mt-0">
          {activeTab === "spotlight" && <EnhancedSpotlightFeed />}
          {activeTab === "your-feed" && <YourFeed />}
        </div>
      </Tabs>
    </div>
  );
};