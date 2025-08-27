import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { 
  Shield, 
  Users, 
  Clock, 
  Check, 
  X, 
  MessageCircle, 
  Settings,
  Crown,
  UserCheck,
  UserMinus 
} from "lucide-react";

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

interface HuddleMember {
  id: string;
  user_id: string;
  joined_at: string;
  profiles: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
}

interface Huddle {
  id: string;
  name: string;
  is_verified: boolean;
  member_count: number;
  owner_id: string;
}

interface HuddleOwnerPanelProps {
  huddle: Huddle;
  isOwner: boolean;
}

export const HuddleOwnerPanel = ({ huddle, isOwner }: HuddleOwnerPanelProps) => {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [members, setMembers] = useState<HuddleMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (isOwner && open) {
      fetchData();
    }
  }, [huddle.id, isOwner, open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchRequests(), fetchMembers()]);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRequests = async () => {
    const { data: requestsData, error } = await supabase
      .from("huddle_join_requests")
      .select("*")
      .eq("huddle_id", huddle.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch profiles
    const userIds = requestsData?.map(req => req.user_id) || [];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const requestsWithProfiles = requestsData?.map(request => ({
        ...request,
        profiles: profilesData?.find(profile => profile.user_id === request.user_id) || null
      })) || [];

      setRequests(requestsWithProfiles as JoinRequest[]);
    } else {
      setRequests([]);
    }
  };

  const fetchMembers = async () => {
    const { data: membersData, error } = await supabase
      .from("huddle_members")
      .select("*")
      .eq("huddle_id", huddle.id)
      .order("joined_at", { ascending: false });

    if (error) throw error;

    // Fetch profiles
    const userIds = membersData?.map(member => member.user_id) || [];
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url")
        .in("user_id", userIds);

      const membersWithProfiles = membersData?.map(member => ({
        ...member,
        profiles: profilesData?.find(profile => profile.user_id === member.user_id) || null
      })) || [];

      setMembers(membersWithProfiles as HuddleMember[]);
    } else {
      setMembers([]);
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
            reviewed_by: user?.id,
            reviewed_at: new Date().toISOString()
          })
          .eq("id", requestId);
        if (error) throw error;
      }

      toast({
        title: action === "approve" ? "Request approved!" : "Request denied",
        description: `Member ${action === "approve" ? "added to" : "denied access to"} your huddle.`,
      });

      // Refresh data
      await fetchData();
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

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === huddle.owner_id) {
      toast({
        title: "Cannot remove owner",
        description: "The huddle owner cannot be removed.",
        variant: "destructive",
      });
      return;
    }

    setActionLoading(memberId);
    try {
      const { error } = await supabase
        .from("huddle_members")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      // Update member count
      const { error: updateError } = await supabase
        .from("huddles")
        .update({ member_count: huddle.member_count - 1 })
        .eq("id", huddle.id);

      if (updateError) throw updateError;

      toast({
        title: "Member removed",
        description: "The member has been removed from the huddle.",
      });

      await fetchData();
    } catch (error: any) {
      console.error("Error removing member:", error);
      toast({
        title: "Failed to remove member",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOwner || !huddle.is_verified) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="w-4 h-4" />
          Manage Huddle
          {requests.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {requests.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-verified-primary" />
            Manage {huddle.name}
            <Badge variant="secondary" className="ml-2">Verified</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="requests" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Requests
              {requests.length > 0 && (
                <Badge variant="destructive">{requests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Members ({members.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading requests...</div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No pending join requests
              </div>
            ) : (
              <div className="space-y-4">
                {requests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={request.profiles?.avatar_url || ""} />
                            <AvatarFallback>
                              {request.profiles?.display_name?.substring(0, 2).toUpperCase() || 
                               request.profiles?.username?.substring(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div className="flex-1">
                            <div className="font-medium">
                              {request.profiles?.display_name || request.profiles?.username || "Unknown User"}
                            </div>
                            <div className="text-xs text-muted-foreground mb-2">
                              {new Date(request.created_at).toLocaleDateString()}
                            </div>
                            
                            {request.message && (
                              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted p-2 rounded">
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
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            {loading ? (
              <div className="text-center py-8">Loading members...</div>
            ) : (
              <div className="space-y-4">
                {members.map((member) => (
                  <Card key={member.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={member.profiles?.avatar_url || ""} />
                            <AvatarFallback>
                              {member.profiles?.display_name?.substring(0, 2).toUpperCase() || 
                               member.profiles?.username?.substring(0, 2).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {member.profiles?.display_name || member.profiles?.username || "Unknown User"}
                              </span>
                              {member.user_id === huddle.owner_id && (
                                <Badge variant="outline" className="gap-1">
                                  <Crown className="w-3 h-3" />
                                  Owner
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Joined {new Date(member.joined_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        
                        {member.user_id !== huddle.owner_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRemoveMember(member.id, member.user_id)}
                            disabled={actionLoading === member.id}
                            className="text-destructive hover:text-destructive"
                          >
                            <UserMinus className="w-3 h-3 mr-1" />
                            Remove
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};