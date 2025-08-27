import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Users, Shield, User } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { HuddleJoinButton } from "@/components/HuddleJoinButton";

interface HuddleSearchSidebarProps {
  isExpanded: boolean;
}

interface Huddle {
  id: string;
  name: string;
  member_count: number;
  is_verified: boolean;
  owner_id: string;
  team: {
    name: string;
    logo_url?: string;
  };
  owner_profile?: {
    display_name?: string;
    username?: string;
  };
}

export const HuddleSearchSidebar = ({ isExpanded }: HuddleSearchSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [huddles, setHuddles] = useState<Huddle[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (searchQuery.trim()) {
      const debounceTimer = setTimeout(() => {
        searchHuddles();
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setHuddles([]);
    }
  }, [searchQuery]);

  const searchHuddles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("huddles")
        .select(`
          id,
          name,
          member_count,
          is_verified,
          owner_id,
          teams:team_id (
            name,
            logo_url
          )
        `)
        .eq("is_private", false)
        .or(`name.ilike.%${searchQuery}%`)
        .limit(5)
        .order("member_count", { ascending: false });

      if (error) throw error;

      // Fetch owner profiles
      const ownerIds = data?.map(h => h.owner_id) || [];
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ownerIds);

      const formattedHuddles = data?.map(huddle => ({
        ...huddle,
        team: huddle.teams || { name: "Unknown Team" },
        owner_profile: ownerProfiles?.find(p => p.user_id === huddle.owner_id)
      })) || [];

      setHuddles(formattedHuddles);
    } catch (error: any) {
      console.error("Error searching huddles:", error);
      toast({
        title: "Search failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSuccess = () => {
    searchHuddles(); // Refresh results
  };

  if (!isExpanded) {
    return null;
  }

  return (
    <div className="p-3 border-t border-sidebar-border">
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 w-3 h-3 text-muted-foreground" />
          <Input
            placeholder="Search huddles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 text-xs h-8"
          />
        </div>

        {loading && (
          <div className="text-xs text-muted-foreground text-center py-2">
            Searching...
          </div>
        )}

        {searchQuery.trim() && !loading && huddles.length === 0 && (
          <div className="text-xs text-muted-foreground text-center py-2">
            No huddles found
          </div>
        )}

        <div className="space-y-2 max-h-64 overflow-y-auto">
          {huddles.map((huddle) => (
            <Card key={huddle.id} className="p-2">
              <CardContent className="p-0">
                <div className="flex items-start gap-2">
                  <Avatar className="w-6 h-6 flex-shrink-0">
                    <AvatarImage src={huddle.team.logo_url} />
                    <AvatarFallback className="text-xs">
                      {huddle.team.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <h4 className="text-xs font-medium truncate">{huddle.name}</h4>
                      {huddle.is_verified && <Shield className="w-3 h-3 text-verified-primary flex-shrink-0" />}
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate">{huddle.team.name}</p>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-2 h-2" />
                      <span className="truncate">
                        {huddle.owner_profile?.display_name || 
                         huddle.owner_profile?.username || 
                         "Unknown"}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-1">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-2 h-2" />
                          <span>{huddle.member_count}</span>
                        </div>
                        {huddle.is_verified && (
                          <Badge variant="secondary" className="text-xs px-1 py-0">
                            Official
                          </Badge>
                        )}
                      </div>
                      <HuddleJoinButton 
                        huddle={huddle} 
                        onJoinSuccess={handleJoinSuccess}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};