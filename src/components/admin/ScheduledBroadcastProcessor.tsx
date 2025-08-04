import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Play, Clock } from "lucide-react";

export const ScheduledBroadcastProcessor = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const processScheduledBroadcasts = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-scheduled-broadcasts');
      
      if (error) throw error;
      
      const result = data;
      toast({
        title: "Processing Complete",
        description: `Processed ${result.processed} posts, ${result.failed} failed`,
      });
    } catch (error) {
      console.error('Error processing scheduled broadcasts:', error);
      toast({
        title: "Error",
        description: "Failed to process scheduled broadcasts",
        variant: "destructive"
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Scheduled Broadcast Processor
        </CardTitle>
        <CardDescription>
          Manually trigger processing of overdue scheduled broadcasts
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button 
          onClick={processScheduledBroadcasts} 
          disabled={processing}
          className="w-full"
        >
          <Play className="w-4 h-4 mr-2" />
          {processing ? "Processing..." : "Process Scheduled Broadcasts"}
        </Button>
      </CardContent>
    </Card>
  );
};