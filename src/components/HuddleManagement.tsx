import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, LogOut, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HuddleManagementProps {
  huddleId: string;
  ownerId: string;
  huddle: any;
}

export const HuddleManagement = ({ huddleId, ownerId, huddle }: HuddleManagementProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isOwner = user?.id === ownerId;

  const handleLeaveHuddle = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Remove user from huddle_members
      const { error: memberError } = await supabase
        .from('huddle_members')
        .delete()
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      // If owner is leaving, handle ownership transfer or deletion
      if (isOwner) {
        // Get remaining members
        const { data: remainingMembers, error: membersError } = await supabase
          .from('huddle_members')
          .select('user_id')
          .eq('huddle_id', huddleId);

        if (membersError) throw membersError;

        if (!remainingMembers || remainingMembers.length === 0) {
          // No remaining members, delete the huddle
          const { error: deleteError } = await supabase
            .from('huddles')
            .delete()
            .eq('id', huddleId);

          if (deleteError) throw deleteError;

          toast({
            title: "Huddle deleted",
            description: "You were the last member, so the huddle has been deleted.",
          });
        } else {
          // Transfer ownership to the first remaining member
          const newOwnerId = remainingMembers[0].user_id;
          const { error: updateError } = await supabase
            .from('huddles')
            .update({ owner_id: newOwnerId })
            .eq('id', huddleId);

          if (updateError) throw updateError;

          toast({
            title: "Left huddle",
            description: "Ownership has been transferred to another member.",
          });
        }
      } else {
        // Update member count
        const { error: updateError } = await supabase
          .from('huddles')
          .update({ member_count: huddle.member_count - 1 })
          .eq('id', huddleId);

        if (updateError) throw updateError;

        toast({
          title: "Left huddle",
          description: "You have successfully left the huddle.",
        });
      }

      navigate('/app');
    } catch (error) {
      console.error('Error leaving huddle:', error);
      toast({
        title: "Error",
        description: "Failed to leave huddle. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHuddle = async () => {
    if (!user || !isOwner) return;
    
    setLoading(true);
    try {
      // Delete huddle (cascade will handle members, messages, etc.)
      const { error } = await supabase
        .from('huddles')
        .delete()
        .eq('id', huddleId);

      if (error) throw error;

      toast({
        title: "Huddle deleted",
        description: "The huddle and all its messages have been permanently deleted.",
      });

      navigate('/app');
    } catch (error) {
      console.error('Error deleting huddle:', error);
      toast({
        title: "Error",
        description: "Failed to delete huddle. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <LogOut className="h-4 w-4 mr-2" />
              Leave Huddle
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave Huddle</AlertDialogTitle>
              <AlertDialogDescription>
                {isOwner 
                  ? "As the owner, leaving this huddle will either transfer ownership to another member or delete it if you're the only member. This action cannot be undone."
                  : "Are you sure you want to leave this huddle? You'll need to be re-invited to join again."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleLeaveHuddle}
                disabled={loading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {loading ? "Leaving..." : "Leave Huddle"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {isOwner && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Huddle
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Huddle</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete the entire huddle, including all messages and member data. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteHuddle}
                  disabled={loading}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {loading ? "Deleting..." : "Delete Huddle"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};