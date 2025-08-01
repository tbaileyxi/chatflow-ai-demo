import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { YourFeed } from "@/components/YourFeed";
import { EnhancedSpotlightFeed } from "@/components/EnhancedSpotlightFeed";

export const FeedTabs = () => {
  const [activeTab, setActiveTab] = useState("your-feed");

  return (
    <div className="flex-1 flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 bg-card border-b border-border rounded-none">
          <TabsTrigger 
            value="your-feed" 
            className="text-lg font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            Your Feed
          </TabsTrigger>
          <TabsTrigger 
            value="spotlight" 
            className="text-lg font-semibold data-[state=active]:bg-spotlight data-[state=active]:text-primary-foreground"
          >
            Spotlight
          </TabsTrigger>
        </TabsList>
        <TabsContent value="your-feed" className="flex-1 mt-0">
          <YourFeed />
        </TabsContent>
        <TabsContent value="spotlight" className="flex-1 mt-0">
          <EnhancedSpotlightFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
};