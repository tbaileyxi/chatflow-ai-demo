import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MobileLayout } from '@/components/mobile/MobileLayout';
import { GlassHeader } from '@/components/mobile/GlassHeader';
import { HuddleManagement } from '@/components/HuddleManagement';
import { HuddleMembersManager } from '@/components/HuddleMembersManager';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface HuddleData {
  id: string;
  name: string;
  owner_id: string;
  team: {
    name: string;
    logo_url?: string;
  };
}

export const HuddleSettings = () => {
  const { huddleId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [huddle, setHuddle] = useState<HuddleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!huddleId) return;

    const fetchHuddle = async () => {
      try {
        const { data, error } = await supabase
          .from('huddles')
          .select(`
            id,
            name,
            owner_id,
            team:teams(name, logo_url)
          `)
          .eq('id', huddleId)
          .single();

        if (error) throw error;
        setHuddle(data);

        // Check if user is admin
        if (user) {
          const { data: roleData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', user.id)
            .eq('role', 'admin')
            .single();
          
          setIsAdmin(!!roleData);
        }
      } catch (error) {
        console.error('Error fetching huddle:', error);
        navigate('/app');
      } finally {
        setLoading(false);
      }
    };

    fetchHuddle();
  }, [huddleId, navigate]);

  if (loading) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Loading..." />
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading huddle settings...</div>
        </div>
      </MobileLayout>
    );
  }

  if (!huddle) {
    return (
      <MobileLayout hasBottomNav={false}>
        <GlassHeader title="Huddle not found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground">This huddle could not be found.</p>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout hasBottomNav={false}>
      <GlassHeader
        title="Huddle Settings"
        subtitle={huddle.name}
        teamLogo={huddle.team?.logo_url}
      />
      
      <div className="flex-1 p-4">
        <div className="space-y-6">
          <div className="bg-card/50 backdrop-blur-sm border border-white/10 rounded-xl p-4">
            <h3 className="text-lg font-semibold mb-4 text-foreground">Huddle Management</h3>
            <HuddleManagement 
              huddleId={huddle.id} 
              ownerId={huddle.owner_id} 
              huddle={huddle} 
            />
          </div>
          
          {(user?.id === huddle.owner_id || isAdmin) && (
            <HuddleMembersManager
              huddleId={huddle.id}
              ownerId={huddle.owner_id}
              isOwner={user?.id === huddle.owner_id}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </MobileLayout>
  );
};