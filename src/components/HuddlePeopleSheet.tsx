import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users, UserPlus, Zap, Settings, LogOut, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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

interface HuddlePeopleSheetProps {
  huddleId: string;
  huddle: any;
  members: any[];
  isOwner: boolean;
  onShowHighlights: () => void;
  onInvite: () => void;
  children: React.ReactNode;
}

export const HuddlePeopleSheet = ({
  huddleId,
  huddle,
  members,
  isOwner,
  onShowHighlights,
  onInvite,
  children
}: HuddlePeopleSheetProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLeaveHuddle = async () => {
    if (!user || !huddleId) return;
    setLoading(true);

    try {
      // If owner, need to handle ownership transfer or deletion
      if (isOwner) {
        const otherMembers = members.filter(m => m.user_id !== user.id);
        
        if (otherMembers.length > 0) {
          // Transfer ownership to first other member
          const newOwnerId = otherMembers[0].user_id;
          await supabase
            .from('huddles')
            .update({ owner_id: newOwnerId })
            .eq('id', huddleId);
        } else {
          // Last member, delete huddle
          await supabase.from('huddles').delete().eq('id', huddleId);
          toast({
            title: "Huddle Deleted",
            description: "You were the last member, so the huddle has been deleted.",
          });
          navigate('/');
          return;
        }
      }

      // Remove user from huddle
      await supabase
        .from('huddle_members')
        .delete()
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id);

      // Update member count
      await supabase
        .from('huddles')
        .update({ member_count: Math.max(0, (huddle?.member_count || 1) - 1) })
        .eq('id', huddleId);

      toast({
        title: "Left Huddle",
        description: "You have left this huddle.",
      });
      navigate('/');
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
    if (!user || !huddleId || !isOwner) return;
    setLoading(true);

    try {
      await supabase.from('huddles').delete().eq('id', huddleId);
      toast({
        title: "Huddle Deleted",
        description: "The huddle has been permanently deleted.",
      });
      navigate('/');
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
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          {children}
        </SheetTrigger>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="text-lg font-bold">
              {huddle?.name || 'Huddle'}
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-4">
            {/* Invite Friends - Big yellow button at top */}
            {user && (
              <Button 
                onClick={() => {
                  onInvite();
                  setOpen(false);
                }}
                className="w-full h-12 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-base"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Invite Friends
              </Button>
            )}

            {/* Members Section */}
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Members ({members.length})
              </h3>
              <ScrollArea className="h-40 rounded-lg border border-border/50 bg-muted/20">
                <div className="p-2 space-y-1">
                  {members.map((member) => (
                    <div 
                      key={member.user_id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatar_url} />
                        <AvatarFallback className="bg-team-primary/20 text-team-primary text-xs">
                          {(member.display_name || member.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {member.display_name || member.username || 'User'}
                        </p>
                        {member.user_id === huddle?.owner_id && (
                          <span className="text-xs text-yellow-400">Owner</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Highlights Button */}
            <Button
              variant="outline"
              onClick={() => {
                onShowHighlights();
                setOpen(false);
              }}
              className="w-full justify-start h-11"
            >
              <Zap className="h-4 w-4 mr-3 text-yellow-400" />
              Highlights
            </Button>

            <Separator />

            {/* Settings - visible to all users */}
            <Button
              variant="ghost"
              onClick={() => {
                navigate(`/huddle/${huddleId}/settings`);
                setOpen(false);
              }}
              className="w-full justify-start h-11"
            >
              <Settings className="h-4 w-4 mr-3" />
              Huddle Settings
            </Button>

            {/* Leave Huddle - Red at bottom */}
            {user && (
              <Button
                variant="ghost"
                onClick={() => setShowLeaveDialog(true)}
                className="w-full justify-start h-11 text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <LogOut className="h-4 w-4 mr-3" />
                Leave Huddle
              </Button>
            )}

            {/* Delete Huddle (owner only) */}
            {isOwner && (
              <Button
                variant="ghost"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full justify-start h-11 text-red-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="h-4 w-4 mr-3" />
                Delete Huddle
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Leave Confirmation Dialog */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this huddle?</AlertDialogTitle>
            <AlertDialogDescription>
              {isOwner && members.length > 1
                ? "As the owner, leaving will transfer ownership to another member."
                : isOwner
                ? "You're the only member. Leaving will delete this huddle."
                : "You can rejoin later if someone invites you."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLeaveHuddle}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? "Leaving..." : "Leave Huddle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this huddle?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the huddle and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteHuddle}
              disabled={loading}
              className="bg-red-500 hover:bg-red-600"
            >
              {loading ? "Deleting..." : "Delete Huddle"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
