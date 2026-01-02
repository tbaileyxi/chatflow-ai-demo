import React, { memo, useCallback } from 'react';
import { Zap, UserPlus, Award, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ChatBottomBarProps {
  huddleId: string;
  huddleName?: string;
  onOpenFades?: () => void;
  onOpenFoundingModal?: () => void;
  className?: string;
}

export const ChatBottomBar = memo(function ChatBottomBar({
  huddleId,
  huddleName,
  onOpenFades,
  onOpenFoundingModal,
  className
}: ChatBottomBarProps) {

  // Handle invite - copies invite link to clipboard
  const handleInvite = useCallback(async () => {
    const inviteUrl = `${window.location.origin}/join-huddle/${huddleId}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invite link copied!');
    } catch {
      toast.info(`Invite link: ${inviteUrl}`);
    }
  }, [huddleId]);

  // Handle fades
  const handleFades = useCallback(() => {
    if (onOpenFades) {
      onOpenFades();
    } else {
      toast.info('Fades coming soon!');
    }
  }, [onOpenFades]);

  // Handle badges
  const handleBadges = useCallback(() => {
    if (onOpenFoundingModal) {
      onOpenFoundingModal();
    } else {
      toast.info('Founding Member badges available!');
    }
  }, [onOpenFoundingModal]);

  // Handle voice - stub for now
  const handleVoice = useCallback(() => {
    toast.info('Voice chat coming soon!');
  }, []);

  const actions = [
    { icon: Zap, label: 'Fade', onClick: handleFades, color: 'text-yellow-400' },
    { icon: UserPlus, label: 'Invite', onClick: handleInvite, color: 'text-cyan-400' },
    { icon: Award, label: 'Badges', onClick: handleBadges, color: 'text-purple-400' },
    { icon: Mic, label: 'Voice', onClick: handleVoice, color: 'text-green-400' },
  ];

  return (
    <div className={cn(
      "flex items-center justify-around py-2 px-4",
      "bg-card/80 backdrop-blur-md border-t border-border/30",
      className
    )}>
      {actions.map(({ icon: Icon, label, onClick, color }) => (
        <Button
          key={label}
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn(
            "flex flex-col items-center gap-0.5 h-auto py-2 px-4",
            "hover:bg-muted/50 active:scale-95 transition-all",
            "text-muted-foreground hover:text-foreground"
          )}
        >
          <Icon className={cn("h-5 w-5", color)} />
          <span className="text-[10px] font-medium">{label}</span>
        </Button>
      ))}
    </div>
  );
});
