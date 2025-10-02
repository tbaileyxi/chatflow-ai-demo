import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InviteButtonProps {
  huddleId: string;
  ownerDisplayName?: string;
  teamName?: string;
  className?: string;
}

export const InviteButton: React.FC<InviteButtonProps> = ({ huddleId, ownerDisplayName, teamName, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join-huddle/${huddleId}`;
  };

  const generateInviteMessage = () => {
    const inviteLink = generateInviteLink();
    if (ownerDisplayName && teamName) {
      return `You have been invited by ${ownerDisplayName} to a private chat in the ${teamName} Side Huddle.\n\n${inviteLink}`;
    }
    return inviteLink;
  };

  const handleCopyInvite = async () => {
    const inviteMessage = generateInviteMessage();
    
    try {
      // Try native share API first on mobile
      if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
        await navigator.share({
          title: `Join ${teamName || 'our huddle'}`,
          text: inviteMessage,
        });
        
        toast({
          title: "Invite shared!",
          description: "Invite link shared successfully",
        });
        return;
      }

      // Fallback to clipboard
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      
      toast({
        title: "Invite copied!",
        description: "Link copied - share it to invite members",
        duration: 3000,
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteMessage;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      toast({
        title: "Invite copied!",
        description: "Link copied - share it to invite members",
        duration: 3000,
      });
      
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Button
      onClick={handleCopyInvite}
      variant="outline"
      size="sm"
      className={className}
    >
      {copied ? (
        <Check className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
    </Button>
  );
};