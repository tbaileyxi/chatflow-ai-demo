import { useCallback, useRef } from 'react';

interface ShareCardData {
  question: string;
  position: string;
  won: boolean;
  chipsRisked: number;
  chipsWon: number;
  winRate: number;
  totalBets: number;
  marketYesPrice?: number;
  isContrarian?: boolean;
  username?: string;
}

type CardFormat = 'square' | 'landscape';

const CARD_DIMS: Record<CardFormat, { w: number; h: number }> = {
  square: { w: 1080, h: 1080 },
  landscape: { w: 1200, h: 675 },
};

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function generateShareCard(data: ShareCardData, format: CardFormat = 'square'): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const { w, h } = CARD_DIMS[format];
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject('Canvas not supported'); return; }

      const profit = data.won ? (data.chipsWon || 100) - data.chipsRisked : -data.chipsRisked;
      const isContrarian = data.isContrarian && data.won;

      // Background gradient
      let grad: CanvasGradient;
      if (isContrarian) {
        grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#b8860b');
        grad.addColorStop(1, '#daa520');
      } else if (data.won) {
        grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#0f4c1a');
        grad.addColorStop(1, '#1a6b2a');
      } else {
        grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, '#2d1111');
        grad.addColorStop(1, '#4a1c1c');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle pattern overlay
      ctx.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < w; i += 40) {
        ctx.fillRect(i, 0, 1, h);
      }

      const pad = w * 0.07;
      const centerX = w / 2;

      // Top headline
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = `bold ${w * 0.065}px system-ui, -apple-system, sans-serif`;
      
      let headline: string;
      if (isContrarian) {
        headline = '🔥 CONTRARIAN WIN';
      } else if (data.won) {
        headline = '✓ CALLED IT';
      } else {
        headline = "CAN'T WIN 'EM ALL";
      }
      ctx.fillText(headline, centerX, h * 0.14);

      if (isContrarian) {
        ctx.font = `${w * 0.035}px system-ui, sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('FADED THE CROWD', centerX, h * 0.19);
      }

      // Question card
      const cardY = h * 0.24;
      const cardH = h * 0.22;
      drawRoundedRect(ctx, pad, cardY, w - pad * 2, cardH, 16);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${w * 0.035}px system-ui, sans-serif`;
      
      // Word wrap question
      const maxW = w - pad * 4;
      const words = data.question.split(' ');
      let line = '';
      let lineY = cardY + cardH * 0.3;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > maxW && line) {
          ctx.fillText(line, centerX, lineY);
          line = word;
          lineY += w * 0.045;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, centerX, lineY);

      // Result + profit
      const resultY = cardY + cardH + h * 0.06;
      ctx.font = `bold ${w * 0.08}px system-ui, sans-serif`;
      ctx.fillStyle = data.won ? '#4ade80' : '#f87171';
      ctx.fillText(
        data.won ? `+${profit}¢` : `${profit}¢`,
        centerX,
        resultY
      );

      ctx.font = `${w * 0.03}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(
        `Picked ${data.position} at ${data.chipsRisked}¢`,
        centerX,
        resultY + w * 0.05
      );

      // Stats section
      const statsY = h * 0.7;
      ctx.font = `bold ${w * 0.028}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.8)';

      const stats = [
        `${data.winRate}% accuracy`,
        `${data.totalBets} bets`,
      ];
      
      if (isContrarian && data.marketYesPrice != null) {
        const crowd = data.position === 'YES' ? (100 - data.marketYesPrice) : data.marketYesPrice;
        stats.push(`Beat the market by ${Math.abs(crowd - 50)}%`);
      }

      stats.forEach((stat, i) => {
        ctx.fillText(stat, centerX, statsY + i * (w * 0.04));
      });

      // Footer
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = `${w * 0.025}px system-ui, sans-serif`;
      const footerText = data.won ? 'Join me on Side Huddle' : 'Think you can do better? Side Huddle';
      ctx.fillText(footerText, centerX, h * 0.92);

      // Username
      if (data.username) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${w * 0.022}px system-ui, sans-serif`;
        ctx.fillText(`@${data.username}`, centerX, h * 0.96);
      }

      // Export
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            reject('Failed to generate image');
          }
        },
        'image/png',
        0.9
      );
    } catch (err) {
      reject(err);
    }
  });
}

// Cache for generated images
const imageCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export async function getCachedShareCard(betId: string, data: ShareCardData, format: CardFormat = 'square'): Promise<string> {
  const key = `${betId}-${format}`;
  const cached = imageCache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.url;
  }

  const url = await generateShareCard(data, format);
  imageCache.set(key, { url, timestamp: Date.now() });
  return url;
}
