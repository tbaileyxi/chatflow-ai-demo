import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Users, Check, X, MessageCircle } from "lucide-react";

interface JoinRequest {
  id: string;
  user_id: string;
  message: string | null;
  created_at: string;
  status: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface HuddleRequestsManagerProps {
  huddleId: string;
  isOwner: boolean;
}

export const HuddleRequestsManager = ({ huddleId, isOwner }: HuddleRequestsManagerProps) => {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOwner) {
      fetchRequests();
    }
  }, [huddleId, isOwner]);

  const fetchRequests = async () => {
    try {
      const { data: requestsData, error } = await supabase
        .from("huddle_join_requests")
        .select("*")
        .eq("huddle_id", huddleId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = requestsData?.map(req => req.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      // Combine data
      const requestsWithProfiles = requestsData?.map(request => ({
        ...request,
        profiles: profilesData?.find(profile => profile.user_id === request.user_id) || null
      })) || [];

      setRequests(requestsWithProfiles as JoinRequest[]);
    } catch (error: any) {
      console.error("Error fetching requests:", error);
      toast({
        title: "Failed to load requests",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequest = async (requestId: string, action: "approve" | "deny") => {
    setActionLoading(requestId);
    try {
      if (action === "approve") {
        const { error } = await supabase.rpc("approve_huddle_join_request", {
          request_id: requestId
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("huddle_join_requests")
          .update({ 
            status: "denied",
            reviewed_by: (await supabase.auth.getUser()).data.user?.id,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", requestId);
        if (error) throw error;
      }

      toast({
        title: action === "approve" ? "Request approved!" : "Request denied",
        description: `Member ${action === "approve" ? "added to" : "denied access to"} your huddle.`,
      });

      // Remove from pending requests
      setRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error: any) {
      console.error(`Error ${action}ing request:`, error);
      toast({
        title: `Failed to ${action} request`,
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOwner || loading) {
    return null;
  }

  if (requests.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Pending Join Requests
          <Badge variant="secondary">{requests.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {requests.map((request) => (
          <div
            key={request.id}
            className="flex items-start justify-between p-4 border rounded-lg"
          >
            <div className="flex items-start gap-3 flex-1">
              <Avatar className="w-8 h-8">
                <AvatarImage src={request.profiles?.avatar_url || ""} />
                <AvatarFallback>
                  {request.profiles?.display_name?.substring(0, 2).toUpperCase() || 
                   request.profiles?.username?.substring(0, 2).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <div className="font-medium">
                  {request.profiles?.display_name || request.profiles?.username || `User ${request.user_id.slice(0, 8)}`}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {new Date(request.created_at).toLocaleDateString()}
                </div>
                
                {request.message && (
                  <div className="flex items-start gap-2 text-sm text-muted-foreground">
                    <MessageCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>{request.message}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRequest(request.id, "deny")}
                disabled={actionLoading === request.id}
                className="text-destructive hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleRequest(request.id, "approve")}
                disabled={actionLoading === request.id}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Check className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};