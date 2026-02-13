import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Share2, Download, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getCachedShareCard } from './ShareCardGenerator';
import { toast } from 'sonner';

interface ShadowBet {
  id: string;
  position: string;
  chips_risked: number;
  chips_won: number;
  won: boolean | null;
  market?: {
    question: string;
    current_yes_price: number;
  };
}

interface BetShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bet: ShadowBet;
  winRate: number;
  totalBets: number;
  username?: string;
}

export function BetShareModal({ open, onOpenChange, bet, winRate, totalBets, username }: BetShareModalProps) {
  const { user } = useAuth();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const profit = bet.won ? (bet.chips_won || 100) - bet.chips_risked : -bet.chips_risked;
  const isContrarian = bet.won && bet.market?.current_yes_price != null && (
    (bet.position === 'YES' && bet.market.current_yes_price < 25) ||
    (bet.position === 'NO' && bet.market.current_yes_price > 75)
  );

  useEffect(() => {
    if (open && bet.market) {
      setLoading(true);
      getCachedShareCard(bet.id, {
        question: bet.market.question,
        position: bet.position,
        won: bet.won === true,
        chipsRisked: bet.chips_risked,
        chipsWon: bet.chips_won,
        winRate,
        totalBets,
        marketYesPrice: bet.market.current_yes_price,
        isContrarian: isContrarian || false,
        username,
      }).then(url => {
        setImageUrl(url);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, [open, bet.id]);

  const trackShare = async (platform: string) => {
    if (!user) return;
    const contentType = isContrarian ? 'contrarian' : bet.won ? 'win' : 'loss';
    await supabase.from('shares').insert({
      user_id: user.id,
      bet_id: bet.id,
      platform,
      shared_content_type: contentType,
    } as any);
  };

  const getShareText = () => {
    const question = bet.market?.question || 'a bet';
    const link = 'https://sidehuddlesports.com';
    
    if (isContrarian) {
      return `🔥 Faded the crowd and WON on @SideHuddle! ${question} when ${100 - (bet.market?.current_yes_price || 50)}% said no. ${link}`;
    }
    if (bet.won) {
      return `Just called it on @SideHuddle! ${question} ✓ ${winRate}% accuracy. Join me: ${link}`;
    }
    return `Can't win 'em all 😅 Still ${winRate}% on @SideHuddle. Think you can beat me? ${link}`;
  };

  const shareToX = async () => {
    await trackShare('x');
    const text = encodeURIComponent(getShareText());
    window.open(`https://x.com/intent/tweet?text=${text}`, '_blank');
  };

  const shareNative = async () => {
    await trackShare('native');
    const shareData: ShareData = {
      title: bet.won ? 'Called it! 🎯' : 'Better luck next time',
      text: getShareText(),
      url: 'https://sidehuddlesports.com',
    };

    // Try to include image if available
    if (imageUrl && navigator.canShare) {
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], 'sidehuddle-bet.png', { type: 'image/png' });
        const dataWithFile = { ...shareData, files: [file] };
        if (navigator.canShare(dataWithFile)) {
          await navigator.share(dataWithFile);
          return;
        }
      } catch { /* fall through */ }
    }

    if (navigator.share) {
      await navigator.share(shareData);
    } else {
      copyLink();
    }
  };

  const downloadImage = async () => {
    if (!imageUrl) return;
    await trackShare('download');
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `sidehuddle-${bet.won ? 'win' : 'loss'}.png`;
    a.click();
    toast.success('Image saved!');
  };

  const copyLink = async () => {
    await trackShare('copy');
    await navigator.clipboard.writeText(getShareText());
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh]">
        <SheetHeader>
          <SheetTitle className="text-center">Share Your {bet.won ? 'Win' : 'Result'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4 pb-6">
          {/* Preview */}
          <div className="flex justify-center">
            {loading ? (
              <div className="w-64 h-64 rounded-xl bg-muted animate-pulse" />
            ) : imageUrl ? (
              <img src={imageUrl} alt="Share card" className="w-64 h-64 rounded-xl object-cover shadow-lg" />
            ) : (
              <div className="w-64 h-64 rounded-xl bg-muted flex items-center justify-center text-muted-foreground text-sm">
                Preview unavailable
              </div>
            )}
          </div>

          {/* Share options */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={shareToX}
            >
              <span className="font-bold">𝕏</span>
              Share to X
            </Button>

            {typeof navigator !== 'undefined' && 'share' in navigator && (
              <Button
                variant="outline"
                className="h-12 gap-2"
                onClick={shareNative}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}

            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={downloadImage}
              disabled={!imageUrl}
            >
              <Download className="h-4 w-4" />
              Download
            </Button>

            <Button
              variant="outline"
              className="h-12 gap-2"
              onClick={copyLink}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
