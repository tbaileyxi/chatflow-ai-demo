import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Users } from "lucide-react";

export const HuddleBar = () => {
  const [activeHuddles] = useState([
    { id: 1, name: "Chiefs Fans", teamName: "Kansas City Chiefs", memberCount: 12 },
    { id: 2, name: "Cowboys Talk", teamName: "Dallas Cowboys", memberCount: 8 },
    { id: 3, name: "Bills Mafia", teamName: "Buffalo Bills", memberCount: 15 }
  ]);

  return (
    <div className="bg-card border-t border-border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground">Side Huddles</h3>
        <Button
          size="sm"
          className="bg-huddle-primary hover:bg-huddle-primary/90 text-white"
        >
          <MessageSquarePlus className="w-4 h-4 mr-2" />
          New Huddle
        </Button>
      </div>
      
      <div className="space-y-2">
        {activeHuddles.map((huddle) => (
          <div
            key={huddle.id}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
          >
            <div className="flex-1">
              <p className="font-medium text-sm">{huddle.name}</p>
              <p className="text-xs text-muted-foreground">{huddle.teamName}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />
              <span>{huddle.memberCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};