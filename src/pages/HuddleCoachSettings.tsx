import { useNavigate, useParams } from "react-router-dom";
import { GlassHeader } from "@/components/mobile/GlassHeader";
import { HuddleChatbotSettings } from "@/components/HuddleChatbotSettings";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export const HuddleCoachSettings = () => {
  const navigate = useNavigate();
  const { huddleId } = useParams();

  return (
    <div className="flex flex-col h-screen bg-background">
      <GlassHeader title="Coach Settings" />
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate(`/huddle/${huddleId}`)}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Huddle
        </Button>
        
        <HuddleChatbotSettings />
      </div>
    </div>
  );
};
