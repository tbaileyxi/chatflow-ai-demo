import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Share2, Link2, Copy, Check, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ShareButtonProps {
  huddleId: string;
  huddleName?: string;
  boostedMessageId?: string;
  className?: string;
}

export const ShareButton = ({
  huddleId,
  huddleName = 'this huddle',
  boostedMessageId,
  className,
}: ShareButtonProps) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const huddleUrl = `${window.location.origin}/join-huddle/${huddleId}`;
  const shareText = `Join ${huddleName} on Side Huddle! 🏈`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(huddleUrl);
      setCopied(true);
      toast({
        title: "Link copied!",
        description: "Share this link to invite fans",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Copy failed",
        description: "Please copy the URL manually",
        variant: "destructive",
      });
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${huddleName} - Side Huddle`,
          text: shareText,
          url: huddleUrl,
        });
        setOpen(false);
      } catch (error) {
        // User cancelled or share failed
        console.log('Share cancelled or failed');
      }
    } else {
      handleCopyLink();
    }
  };

  const handleShareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(huddleUrl)}`;
    window.open(url, '_blank', 'width=550,height=420');
    setOpen(false);
  };

  const handleShareToSMS = () => {
    const url = `sms:?body=${encodeURIComponent(`${shareText} ${huddleUrl}`)}`;
    window.open(url);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-12 w-12 rounded-full",
              "bg-primary/90 hover:bg-primary text-primary-foreground",
              "shadow-lg hover:shadow-xl transition-all",
              "fixed bottom-24 right-4 z-30",
              className
            )}
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </motion.div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-56 p-2 bg-background/95 backdrop-blur-sm border-primary/20"
        side="top"
        align="end"
      >
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNativeShare}
            className="w-full justify-start h-10"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Huddle
          </Button>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="w-full justify-start h-10"
          >
            {copied ? (
              <Check className="w-4 h-4 mr-2 text-green-500" />
            ) : (
              <Link2 className="w-4 h-4 mr-2" />
            )}
            {copied ? 'Copied!' : 'Copy Link'}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleShareToTwitter}
            className="w-full justify-start h-10"
          >
            <span className="w-4 h-4 mr-2 font-bold">𝕏</span>
            Post to X
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleShareToSMS}
            className="w-full justify-start h-10"
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Text a Friend
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
