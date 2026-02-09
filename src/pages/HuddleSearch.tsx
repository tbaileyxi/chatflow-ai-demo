import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Search, Users, Shield, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
  bio?: string;
  team: {
    name: string;
    logo_url?: string;
  };
  owner_profile?: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
    bio?: string;
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
  const [expandedBio, setExpandedBio] = useState<string | null>(null);
  const [memberHuddleIds, setMemberHuddleIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchHuddles();
    if (user) fetchMemberships();
  }, [user]);

  const fetchMemberships = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("huddle_members")
      .select("huddle_id")
      .eq("user_id", user.id);
    if (data) {
      setMemberHuddleIds(new Set(data.map(m => m.huddle_id)));
    }
  };

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
          owner_id,
          bio,
          teams!team_id (
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

      // Fetch owner profiles separately (including avatar_url and bio)
      const ownerIds = data?.map(h => h.owner_id) || [];
      const { data: ownerProfiles } = await supabase
        .from("profiles")
        .select("user_id, display_name, username, avatar_url, bio")
        .in("user_id", ownerIds);

      const formattedHuddles = data?.map(huddle => ({
        ...huddle,
        team: huddle.teams || { name: "Unknown Team" },
        owner_profile: ownerProfiles?.find(p => p.user_id === huddle.owner_id),
        pricing: huddle.huddle_pricing || null
      })) || [];

      setVerifiedHuddles(formattedHuddles);
    } catch (error: any) {
      console.error("Error fetching hosted huddles:", error);
      toast({
        title: "Failed to load hosted huddles",
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

  const renderHuddleCard = (huddle: Huddle) => {
    const ownerName = huddle.owner_profile?.display_name || huddle.owner_profile?.username || 'Unknown';
    const huddleBio = huddle.bio;

    return (
      <div 
        key={huddle.id} 
        className="bg-card/50 border border-border/30 rounded-xl p-4 hover:bg-card/70 transition-all"
      >
        <div className="flex items-start gap-3">
          <Avatar className="w-12 h-12 rounded-xl ring-2 ring-primary/20 shrink-0">
            <AvatarImage src={huddle.team.logo_url} />
            <AvatarFallback className="rounded-xl bg-muted text-sm font-bold">
              {huddle.team.name.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{huddle.name}</h3>
              {huddle.is_verified && <VerifiedBadge size="sm" />}
            </div>
            <p className="text-sm text-muted-foreground truncate">{huddle.team.name}</p>
            
            {/* Hosted by line */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-xs text-muted-foreground">Hosted by</span>
              <Avatar className="w-5 h-5">
                <AvatarImage src={huddle.owner_profile?.avatar_url || undefined} />
                <AvatarFallback className="text-[8px]">
                  {ownerName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-foreground">{ownerName}</span>
            </div>

            {/* Bio */}
            {huddleBio && (
              <div className="mt-2">
                <p className={`text-xs text-muted-foreground ${expandedBio !== huddle.id ? 'line-clamp-2' : ''}`}>
                  {huddleBio}
                </p>
                {huddleBio.length > 100 && (
                  <button 
                    onClick={() => setExpandedBio(expandedBio === huddle.id ? null : huddle.id)}
                    className="text-xs text-primary hover:underline mt-1 font-medium"
                  >
                    {expandedBio === huddle.id ? 'Show less' : 'More...'}
                  </button>
                )}
              </div>
            )}

            {/* Price + Join */}
            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                {huddle.pricing?.is_enabled ? (
                  <span className="text-sm font-semibold text-green-500">
                    ${(huddle.pricing.price_per_month / 100).toFixed(2)}/mo
                  </span>
                ) : (
                  <span className="text-sm font-semibold text-primary">FREE</span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {huddle.member_count}
                </span>
              </div>
              {(memberHuddleIds.has(huddle.id) || huddle.owner_id === user?.id) ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); navigate(`/huddle/${huddle.id}`); }}
                  className="border-emerald-500/50 text-emerald-500 hover:bg-emerald-500/10"
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Enter Huddle
                </Button>
              ) : (
                <HuddleJoinButton 
                  huddle={huddle} 
                  onJoinSuccess={() => { fetchHuddles(); if (user) fetchMemberships(); }}
                  membershipRequired={huddle.pricing?.is_enabled || false}
                  membershipPrice={huddle.pricing?.price_per_month || 0}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="relative flex flex-col h-screen">
        <GlassHeader 
          title="Hosted Huddles"
          onBack={() => window.history.back()}
        />
        
        {!user && (
          <div className="bg-primary/10 border-b border-primary/30 p-3">
            <div className="container mx-auto max-w-4xl flex items-center justify-between gap-3">
              <p className="text-sm text-foreground">
                <span className="font-semibold text-primary">Sign in</span> to join and participate in huddles
              </p>
              <Button 
                size="sm"
                onClick={() => window.location.href = '/auth'}
                className="bg-primary hover:bg-primary/90 shrink-0"
              >
                Sign In
              </Button>
            </div>
          </div>
        )}
        
        <div className="flex-1 overflow-auto pb-20">
          <div className="container mx-auto p-4 max-w-4xl">
            <div className="mb-6">
              <p className="text-muted-foreground text-sm">
                Browse hosted team huddles. {!user && "Sign in to join and participate in conversations."}
              </p>
            </div>

            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search hosted huddles or teams..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-12 bg-muted/30 border-border/50 rounded-xl text-base"
              />
            </div>

            <div className="mb-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="font-semibold text-foreground text-sm">Hosted Huddles</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These huddles are hosted by creators and open to join.
                  </p>
                </div>
                <CreateVerifiedHuddleDialog 
                  onHuddleCreated={fetchHuddles}
                  trigger={
                    <Button className="bg-primary hover:bg-primary/90 shrink-0 rounded-xl">
                      <Shield className="w-4 h-4 mr-2" />
                      Create
                    </Button>
                  }
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">Loading hosted huddles...</div>
            ) : (
              <div className="grid gap-3 pb-4">
                {filteredHuddles().length > 0 ? (
                  filteredHuddles().map(renderHuddleCard)
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "No hosted huddles found matching your search" : "No hosted huddles available yet"}
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
