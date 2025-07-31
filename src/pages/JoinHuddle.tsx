import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Users, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface Huddle {
  id: string;
  name: string;
  team_id: string;
  member_count: number;
  owner_id: string;
  teams: {
    name: string;
    city: string;
    league: string;
    logo_url?: string;
  };
}

export const JoinHuddle = () => {
  const { huddleId } = useParams<{ huddleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [huddle, setHuddle] = useState<Huddle | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [alreadyMember, setAlreadyMember] = useState(false);

  useEffect(() => {
    if (!huddleId) {
      navigate('/');
      return;
    }

    fetchHuddle();
  }, [huddleId]);

  const fetchHuddle = async () => {
    try {
      // Fetch huddle details
      const { data: huddleData, error: huddleError } = await supabase
        .from('huddles')
        .select(`
          id,
          name,
          team_id,
          member_count,
          owner_id,
          teams(name, city, league, logo_url)
        `)
        .eq('id', huddleId)
        .single();

      if (huddleError) throw huddleError;

      setHuddle(huddleData);

      // Check if user is already a member
      if (user) {
        const { data: memberData } = await supabase
          .from('huddle_members')
          .select('id')
          .eq('huddle_id', huddleId)
          .eq('user_id', user.id)
          .single();

        setAlreadyMember(!!memberData);
      }
    } catch (error: any) {
      toast({
        title: "Huddle not found",
        description: "This huddle doesn't exist or is no longer available.",
        variant: "destructive"
      });
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinHuddle = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join this huddle.",
        variant: "destructive"
      });
      navigate('/auth');
      return;
    }

    if (!huddle) return;

    setJoining(true);

    try {
      // Add user to huddle
      const { error: memberError } = await supabase
        .from('huddle_members')
        .insert({
          huddle_id: huddle.id,
          user_id: user.id
        });

      if (memberError) throw memberError;

      // Update member count
      const { error: updateError } = await supabase
        .from('huddles')
        .update({ 
          member_count: huddle.member_count + 1,
          last_message_at: new Date().toISOString()
        })
        .eq('id', huddle.id);

      if (updateError) throw updateError;

      toast({
        title: "Welcome to the huddle!",
        description: `You've successfully joined ${huddle.name}`,
      });

      navigate(`/huddle/${huddle.id}`);
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        toast({
          title: "Already a member",
          description: "You're already a member of this huddle.",
        });
        navigate(`/huddle/${huddle.id}`);
      } else {
        toast({
          title: "Failed to join",
          description: error.message || "Something went wrong. Please try again.",
          variant: "destructive"
        });
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!huddle) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Huddle not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {huddle.teams.logo_url && (
            <div className="flex justify-center mb-4">
              <img
                src={huddle.teams.logo_url}
                alt={`${huddle.teams.name} logo`}
                className="w-16 h-16 rounded-full object-cover"
              />
            </div>
          )}
          <CardTitle className="text-2xl">Join Huddle</CardTitle>
          <CardDescription>
            You've been invited to join a team huddle
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <h3 className="text-xl font-semibold">{huddle.name}</h3>
            <p className="text-muted-foreground">
              {huddle.teams.name} • {huddle.teams.city}
            </p>
            {huddle.teams.league && (
              <p className="text-sm text-muted-foreground">{huddle.teams.league}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{huddle.member_count} members</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              <span>Active chat</span>
            </div>
          </div>

          {alreadyMember ? (
            <div className="space-y-3">
              <p className="text-center text-sm text-muted-foreground">
                You're already a member of this huddle
              </p>
              <Button
                onClick={() => navigate(`/huddle/${huddle.id}`)}
                className="w-full"
              >
                Go to Huddle
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Button
                onClick={handleJoinHuddle}
                disabled={joining}
                className="w-full"
              >
                {joining ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Join Huddle
                  </>
                )}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="w-full"
              >
                Maybe Later
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};