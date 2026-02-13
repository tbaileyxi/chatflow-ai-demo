import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, LogOut, Trash2, Shield, Users, Zap, Bot, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface HuddleSettingsDropdownProps {
  huddleId: string;
  ownerId: string;
  isOwner: boolean;
  isVerified?: boolean;
  huddle: any;
  className?: string;
}

export const HuddleSettingsDropdown: React.FC<HuddleSettingsDropdownProps> = ({
  huddleId,
  ownerId,
  isOwner,
  isVerified,
  huddle,
  className = '',
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleLeaveHuddle = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (isOwner) {
        // Check for other members
        const { data: otherMembers } = await supabase
          .from('huddle_members')
          .select('user_id')
          .eq('huddle_id', huddleId)
          .neq('user_id', user.id)
          .limit(1);

        if (otherMembers && otherMembers.length > 0) {
          // Transfer ownership
          const newOwnerId = otherMembers[0].user_id;
          const { error: updateError } = await supabase
            .from('huddles')
            .update({ owner_id: newOwnerId })
            .eq('id', huddleId);

          if (updateError) throw updateError;

          // Remove current owner from members
          await supabase
            .from('huddle_members')
            .delete()
            .eq('huddle_id', huddleId)
            .eq('user_id', user.id);

          toast({
            title: "Ownership transferred",
            description: "You have left the huddle and ownership has been transferred.",
          });
        } else {
          // Last member - delete huddle
          await handleDeleteHuddle();
          return;
        }
      } else {
        // Regular member leaving
        const { error } = await supabase
          .from('huddle_members')
          .delete()
          .eq('huddle_id', huddleId)
          .eq('user_id', user.id);

        if (error) throw error;

        // Update member count
        await supabase
          .from('huddles')
          .update({ 
            member_count: (huddle.member_count || 1) - 1,
            last_message_at: new Date().toISOString()
          })
          .eq('id', huddleId);

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
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowLeaveDialog(false);
    }
  };

  const handleDeleteHuddle = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('huddles')
        .delete()
        .eq('id', huddleId)
        .eq('owner_id', ownerId);

      if (error) throw error;

      toast({
        title: "Huddle deleted",
        description: "The huddle has been permanently deleted.",
      });

      navigate('/app');
    } catch (error) {
      console.error('Error deleting huddle:', error);
      toast({
        title: "Error",
        description: "Failed to delete huddle. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 sm:h-9 sm:w-9 p-0 rounded-full hover:bg-team-primary/20 ${className}`}
            aria-label="Huddle settings"
          >
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-team-primary" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            Settings
            {isVerified && (
              <Badge variant="default" className="bg-team-primary text-xs">
                Verified
              </Badge>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={() => {
            const teamId = huddle?.team_id;
            const params = new URLSearchParams();
            if (teamId) params.set('teamId', teamId);
            params.set('huddleId', huddleId);
            navigate(`/ledger?${params.toString()}`);
          }}>
            <Receipt className="mr-2 h-4 w-4" />
            View Ledger
          </DropdownMenuItem>

          {isOwner && (
            <>
              <DropdownMenuItem onClick={() => navigate(`/huddle/${huddleId}/settings`)}>
                <Users className="mr-2 h-4 w-4" />
                Manage Members
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate(`/huddle/${huddleId}/settings`)}>
                <Zap className="mr-2 h-4 w-4" />
                Pick'Em Settings
              </DropdownMenuItem>

              <DropdownMenuItem onClick={() => navigate(`/huddle/${huddleId}/coach-settings`)}>
                <Bot className="mr-2 h-4 w-4" />
                Coach Settings
              </DropdownMenuItem>

              <DropdownMenuSeparator />
            </>
          )}

          <DropdownMenuItem
            onClick={() => setShowLeaveDialog(true)}
            className="text-orange-600 focus:text-orange-600"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Leave Huddle
          </DropdownMenuItem>

          {isOwner && (
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Huddle
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave Huddle?</AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner
                ? "As the owner, leaving will transfer ownership to another member. If you're the last member, the huddle will be deleted."
                : "Are you sure you want to leave this huddle? You'll need an invite to rejoin."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeaveHuddle} disabled={loading}>
              {loading ? 'Leaving...' : 'Leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Huddle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the huddle and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHuddle}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
