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
        <TabsList className="grid w-full grid-cols-2 bg-card border-b border-border rounded-none">
          <TabsTrigger 
            value="spotlight" 
            className="text-lg font-semibold data-[state=active]:bg-spotlight data-[state=active]:text-primary-foreground"
          >
            Spotlight
          </TabsTrigger>
          <TabsTrigger 
            value="your-feed" 
            className="text-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground flex items-center gap-2"
          >
            Your Feed
            {activeTab === "your-feed" && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  window.location.href = '/teams';
                }}
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="spotlight" className="flex-1 mt-0">
          <EnhancedSpotlightFeed />
        </TabsContent>
        <TabsContent value="your-feed" className="flex-1 mt-0">
          <YourFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
};