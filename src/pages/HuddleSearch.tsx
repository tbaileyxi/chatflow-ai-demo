import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
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
import { MobileLayout } from "@/components/mobile/MobileLayout";
import { GlassHeader } from "@/components/mobile/GlassHeader";
import { BottomNav } from "@/components/mobile/BottomNav";
import { CreateVerifiedHuddleDialog } from "@/components/CreateVerifiedHuddleDialog";

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
  pricing?: {
    is_enabled: boolean;
    price_per_month: number;
  };
}

export const HuddleSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [verifiedHuddles, setVerifiedHuddles] = useState<Huddle[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchHuddles();
  }, []);

  const fetchHuddles = async () => {
    setLoading(true);
    try {
      // Only fetch verified huddles since those are the only ones discoverable
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
          ),
          huddle_pricing!left (
            is_enabled,
            price_per_month
          )
        `)
        .eq("is_private", false)
        .eq("is_verified", true)
        .order("member_count", { ascending: false });

      if (error) throw error;

      // Fetch owner profiles separately
      const ownerIds = data?.map(h => h.owner_id) || [];
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username")
        .in("user_id", ownerIds);

      const formattedHuddles = data?.map(huddle => ({
        ...huddle,
        team: huddle.teams || { name: "Unknown Team" },
        owner_profile: ownerProfiles?.find(p => p.user_id === huddle.owner_id),
        pricing: huddle.huddle_pricing?.[0] || null
      })) || [];

      setVerifiedHuddles(formattedHuddles);
    } catch (error: any) {
      console.error("Error fetching verified huddles:", error);
      toast({
        title: "Failed to load verified huddles",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredHuddles = () => {
    if (!searchQuery.trim()) return verifiedHuddles;
    
    return verifiedHuddles.filter(huddle =>
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
              <p className="text-xs text-muted-foreground">
                Owner: {huddle.owner_profile?.display_name || huddle.owner_profile?.username || "Unknown"}
              </p>
            </div>
          </div>
          <HuddleJoinButton 
            huddle={huddle} 
            onJoinSuccess={fetchHuddles}
            membershipRequired={huddle.pricing?.is_enabled || false}
            membershipPrice={huddle.pricing?.price_per_month || 0}
          />
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
          {huddle.pricing?.is_enabled ? (
            <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-700 dark:text-green-400">
              ${(huddle.pricing.price_per_month / 100).toFixed(2)}/mo
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400">
              FREE
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-background crt-effect">
      <div className="fixed inset-0 pointer-events-none opacity-10">
        <div className="absolute inset-0 retro-grid"></div>
        <div className="absolute inset-0 retro-scanlines"></div>
      </div>
      <div className="relative">
        <GlassHeader 
          title="Discover Verified Huddles"
          onBack={() => window.history.back()}
        />
        <div className="flex-1 overflow-auto font-arcade">
        <div className="container mx-auto p-4 max-w-4xl">
          <Card className="mb-4 bg-verified-background border-verified-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-5 h-5 text-verified-primary" />
                    <h3 className="font-semibold text-verified-primary">Own a Team?</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create your own verified huddle and become discoverable to fans
                  </p>
                </div>
                <CreateVerifiedHuddleDialog 
                  onHuddleCreated={fetchHuddles}
                  trigger={
                    <Button className="bg-verified-primary hover:bg-verified-primary/90 shrink-0">
                      <Shield className="w-4 h-4 mr-2" />
                      Create Verified
                    </Button>
                  }
                />
              </div>
            </CardContent>
          </Card>

          <div className="mb-4">
            <p className="text-muted-foreground text-sm">
              Join official team huddles with curated membership and enhanced features
            </p>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search verified huddles or teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="mb-4 p-3 bg-verified-background border border-verified-border rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-verified-primary" />
              <span className="font-medium text-verified-primary text-sm">Official Huddles Only</span>
            </div>
            <p className="text-xs text-muted-foreground">
              These huddles have been verified and are open for join requests. All other huddles are invite-only.
            </p>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading verified huddles...</div>
          ) : (
            <div className="grid gap-3 pb-4">
              {filteredHuddles().length > 0 ? (
                filteredHuddles().map(renderHuddleCard)
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {searchQuery ? "No verified huddles found matching your search" : "No verified huddles available yet"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <BottomNav />
      </div>
    </div>
  );
};