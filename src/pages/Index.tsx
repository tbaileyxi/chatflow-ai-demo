import { FeedTabs } from "@/components/FeedTabs";
import { HuddleBar } from "@/components/HuddleBar";
import { Button } from "@/components/ui/button";
import { Menu, Search, Settings } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-card border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm">
              <Menu className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-huddle-primary bg-clip-text text-transparent">
              Side Huddle
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm">
              <Search className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="sm">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <FeedTabs />
      </div>

      {/* Bottom Huddle Bar */}
      <HuddleBar />
    </div>
  );
};

export default Index;
