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
      await navigator.clipboard.writeText(inviteMessage);
      setCopied(true);
      
      toast({
        title: "Invite message copied!",
        description: "Share this personalized invite to join the huddle",
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
        title: "Invite message copied!",
        description: "Share this personalized invite to join the huddle",
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