import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Users, Shield } from "lucide-react";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { HuddleJoinButton } from "@/components/HuddleJoinButton";

interface Huddle {
  id: string;
  name: string;
  member_count: number;
  is_verified: boolean;
  team: {
    name: string;
    logo_url?: string;
  };
}

export const HuddleSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [allHuddles, setAllHuddles] = useState<Huddle[]>([]);
  const [verifiedHuddles, setVerifiedHuddles] = useState<Huddle[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchHuddles();
  }, []);

  const fetchHuddles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("huddles")
        .select(`
          id,
          name,
          member_count,
          is_verified,
          teams:team_id (
            name,
            logo_url
          )
        `)
        .eq("is_private", false)
        .order("member_count", { ascending: false });

      if (error) throw error;

      const formattedHuddles = data?.map(huddle => ({
        ...huddle,
        team: huddle.teams || { name: "Unknown Team" }
      })) || [];

      setAllHuddles(formattedHuddles);
      setVerifiedHuddles(formattedHuddles.filter(h => h.is_verified));
    } catch (error: any) {
      console.error("Error fetching huddles:", error);
      toast({
        title: "Failed to load huddles",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredHuddles = (huddles: Huddle[]) => {
    if (!searchQuery.trim()) return huddles;
    
    return huddles.filter(huddle =>
      huddle.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      huddle.team.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const renderHuddleCard = (huddle: Huddle) => (
    <Card key={huddle.id} className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10">
              <AvatarImage src={huddle.team.logo_url} />
              <AvatarFallback>
                {huddle.team.name.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">{huddle.name}</CardTitle>
                {huddle.is_verified && <VerifiedBadge size="sm" />}
              </div>
              <p className="text-sm text-muted-foreground">{huddle.team.name}</p>
            </div>
          </div>
          <HuddleJoinButton huddle={huddle} onJoinSuccess={fetchHuddles} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{huddle.member_count} members</span>
          </div>
          {huddle.is_verified && (
            <Badge variant="secondary" className="text-xs">
              <Shield className="w-3 h-3 mr-1" />
              Official
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Discover Huddles</h1>
        <p className="text-muted-foreground">
          Find and join team huddles to connect with other fans
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search huddles or teams..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="all">All Huddles</TabsTrigger>
          <TabsTrigger value="verified" className="flex items-center gap-2">
            <Shield className="w-3 h-3" />
            Verified Only
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {loading ? (
            <div className="text-center py-8">Loading huddles...</div>
          ) : (
            <div className="grid gap-4">
              {filteredHuddles(allHuddles).length > 0 ? (
                filteredHuddles(allHuddles).map(renderHuddleCard)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No huddles found matching your search" : "No public huddles available"}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="verified" className="mt-6">
          <div className="mb-4 p-4 bg-verified-background border border-verified-border rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-verified-primary" />
              <span className="font-medium text-verified-primary">Verified Huddles</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Official huddles with curated membership and enhanced features.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading verified huddles...</div>
          ) : (
            <div className="grid gap-4">
              {filteredHuddles(verifiedHuddles).length > 0 ? (
                filteredHuddles(verifiedHuddles).map(renderHuddleCard)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No verified huddles found matching your search" : "No verified huddles available yet"}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};