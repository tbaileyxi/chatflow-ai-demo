import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Users, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface MessageData {
  id: string;
  content: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  user_id: string;
  huddle_id: string;
}

interface ProfileData {
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface HuddleData {
  id: string;
  name: string;
  team_id: string;
  member_count: number | null;
}

interface TeamData {
  name: string;
  logo_url: string | null;
}

export const MessagePost = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-message', id],
    queryFn: async () => {
      if (!id) throw new Error('No message ID provided');

      // Fetch message
      const { data: message, error: messageError } = await supabase
        .from('huddle_messages')
        .select('id, content, created_at, media_url, media_type, user_id, huddle_id')
        .eq('id', id)
        .single();

      if (messageError || !message) {
        throw new Error('Message not found');
      }

      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, username, avatar_url')
        .eq('user_id', message.user_id)
        .single();

      // Fetch huddle
      const { data: huddle } = await supabase
        .from('huddles')
        .select('id, name, team_id, member_count')
        .eq('id', message.huddle_id)
        .single();

      // Fetch team if huddle exists
      let team: TeamData | null = null;
      if (huddle?.team_id) {
        const { data: teamData } = await supabase
          .from('teams')
          .select('name, logo_url')
          .eq('id', huddle.team_id)
          .single();
        team = teamData;
      }

      return {
        message: message as MessageData,
        profile: profile as ProfileData | null,
        huddle: huddle as HuddleData | null,
        team
      };
    },
    enabled: !!id
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground" />
            <h1 className="text-xl font-semibold">Message not found</h1>
            <p className="text-muted-foreground">
              This message may have been deleted or you don't have access to view it.
            </p>
            <Button onClick={() => navigate('/')} variant="default">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { message, profile, huddle, team } = data;
  const displayName = profile?.display_name || profile?.username || 'Anonymous';
  const avatarUrl = profile?.avatar_url;
  const huddleName = huddle?.name || 'a Huddle';
  const teamLogo = team?.logo_url;

  // OG meta values
  const ogTitle = `@${profile?.username || 'fan'} in ${huddleName}`;
  const ogDescription = message.content.slice(0, 160);
  const ogImage = message.media_url || teamLogo || 'https://sidehuddlesports.com/lovable-uploads/4520766b-9c2a-467d-a68c-44031ab9f4ba.png';

  return (
    <>
      <Helmet>
        <title>{ogTitle} | Side Huddle</title>
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:url" content={`https://sidehuddlesports.com/message/${id}`} />
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        <meta name="twitter:image" content={ogImage} />
      </Helmet>

      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-4 py-3">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => navigate(-1)}
              className="shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold">Shared Message</h1>
              <p className="text-xs text-muted-foreground">from {huddleName}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-2xl mx-auto p-4 space-y-4">
          {/* Message Card */}
          <Card>
            <CardContent className="pt-4">
              {/* Author Row */}
              <div className="flex items-center gap-3 mb-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarUrl || undefined} alt={displayName} />
                  <AvatarFallback className="bg-muted">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>

              {/* Message Content */}
              <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                {message.content}
              </p>

              {/* Media */}
              {message.media_url && (
                <div className="mt-3">
                  {message.media_type === 'video' ? (
                    <video
                      src={message.media_url}
                      controls
                      className="w-full rounded-lg max-h-96 object-contain bg-black"
                    />
                  ) : (
                    <img
                      src={message.media_url}
                      alt=""
                      className="w-full rounded-lg max-h-96 object-contain"
                      loading="lazy"
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Huddle CTA */}
          {huddle && (
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  {teamLogo && (
                    <img 
                      src={teamLogo} 
                      alt={team?.name} 
                      className="w-12 h-12 rounded-lg object-contain bg-background"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{huddleName}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {huddle.member_count || 0} members
                    </p>
                  </div>
                  <Button 
                    onClick={() => navigate(`/join-huddle/${huddle.id}`)}
                    size="sm"
                  >
                    Join Huddle
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
};

export default MessagePost;
