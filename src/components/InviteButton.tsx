import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InviteButtonProps {
  huddleId: string;
  className?: string;
}

export const InviteButton: React.FC<InviteButtonProps> = ({ huddleId, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const generateInviteLink = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/join-huddle/${huddleId}`;
  };

  const handleCopyInvite = async () => {
    const inviteLink = generateInviteLink();
    
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      
      toast({
        title: "Invite link copied!",
        description: "Share this link to invite others to join the huddle",
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      
      setCopied(true);
      toast({
        title: "Invite link copied!",
        description: "Share this link to invite others to join the huddle",
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
        <>
          <Check className="h-4 w-4 mr-2" />
          Copied!
        </>
      ) : (
        <>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite
        </>
      )}
    </Button>
  );
};