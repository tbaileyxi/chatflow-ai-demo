import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Users, UserMinus, Crown, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Member {
  user_id: string;
  profiles: {
    display_name?: string;
    username?: string;
    avatar_url?: string;
  } | null;
  joined_at: string;
  isOwner: boolean;
  isAdmin: boolean;
}

interface HuddleMembersManagerProps {
  huddleId: string;
  ownerId: string;
  isOwner: boolean;
  isAdmin: boolean;
}

export const HuddleMembersManager = ({ huddleId, ownerId, isOwner, isAdmin }: HuddleMembersManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  useEffect(() => {
    fetchMembers();
  }, [huddleId]);

  const fetchMembers = async () => {
    try {
      // Get all huddle members
      const { data: memberData, error: memberError } = await supabase
        .from('huddle_members')
        .select('user_id, joined_at')
        .eq('huddle_id', huddleId);

      if (memberError) throw memberError;

      // Get owner info
      const { data: huddleData, error: huddleError } = await supabase
        .from('huddles')
        .select('owner_id')
        .eq('id', huddleId)
        .single();

      if (huddleError) throw huddleError;

      // Combine all user IDs (members + owner, remove duplicates)
      const memberIds = memberData?.map(m => m.user_id) || [];
      const allUserIds = [...new Set([...memberIds, huddleData.owner_id])];

      // Get profiles for all users
      const profilePromises = allUserIds.map(userId => 
        supabase.rpc('get_public_profile', { target_user_id: userId })
      );
      const profileResults = await Promise.all(profilePromises);
      const profiles = profileResults.map(result => result.data?.[0]).filter(Boolean);

      // Check for admin roles
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .in('user_id', allUserIds);

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Create member objects with all data
      const membersWithDetails = allUserIds.map(userId => {
        const memberInfo = memberData?.find(m => m.user_id === userId);
        const profile = profiles.find(p => p.user_id === userId);
        
        return {
          user_id: userId,
          profiles: profile || null,
          joined_at: memberInfo?.joined_at || new Date().toISOString(),
          isOwner: userId === huddleData.owner_id,
          isAdmin: adminUserIds.has(userId)
        };
      });

      // Sort: owner first, then admins, then by join date
      membersWithDetails.sort((a, b) => {
        if (a.isOwner) return -1;
        if (b.isOwner) return 1;
        if (a.isAdmin && !b.isAdmin) return -1;
        if (b.isAdmin && !a.isAdmin) return 1;
        return new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime();
      });

      setMembers(membersWithDetails);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast({
        title: "Error",
        description: "Failed to load members. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!user || memberId === ownerId || memberId === user.id) return;
    
    setRemovingMember(memberId);
    try {
      const { error } = await supabase
        .from('huddle_members')
        .delete()
        .eq('huddle_id', huddleId)
        .eq('user_id', memberId);

      if (error) throw error;

      toast({
        title: "Member removed",
        description: "The member has been successfully removed from the huddle.",
      });

      // Refresh members list
      await fetchMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      toast({
        title: "Error",
        description: "Failed to remove member. Please try again.",
        variant: "destructive"
      });
    } finally {
      setRemovingMember(null);
    }
  };

  const canRemoveMember = (member: Member) => {
    if (!user) return false;
    if (member.user_id === user.id) return false; // Can't remove yourself
    if (member.isOwner) return false; // Can't remove owner
    if (member.isAdmin && !isAdmin && !isOwner) return false; // Only admins/owners can remove admins
    return isOwner || isAdmin; // Must be owner or admin to remove others
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Members</h3>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted"></div>
              <div className="flex-1">
                <div className="w-24 h-4 bg-muted rounded mb-1"></div>
                <div className="w-16 h-3 bg-muted rounded"></div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Members ({members.length})</h3>
      </div>

      <div className="space-y-3">
        {members.map((member) => (
          <div key={member.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-card border hover:bg-accent/50 transition-colors">
            <Avatar className="w-10 h-10">
              <AvatarImage src={member.profiles?.avatar_url} />
              <AvatarFallback>
                {(member.profiles?.display_name || member.profiles?.username)?.substring(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">
                  {member.profiles?.display_name || member.profiles?.username || 'Anonymous'}
                </p>
                {member.isOwner && (
                  <div title="Owner">
                    <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  </div>
                )}
                {member.isAdmin && !member.isOwner && (
                  <div title="Admin">
                    <Shield className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Joined {new Date(member.joined_at).toLocaleDateString()}
                {member.user_id === user?.id && ' (You)'}
              </p>
            </div>

            {canRemoveMember(member) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={removingMember === member.user_id}
                  >
                    <UserMinus className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove Member</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to remove{' '}
                      <strong>{member.profiles?.display_name || member.profiles?.username || 'this member'}</strong>{' '}
                      from the huddle? They will need to be re-invited to rejoin.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleRemoveMember(member.user_id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Remove Member
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No members found</p>
        </div>
      )}
    </Card>
  );
};