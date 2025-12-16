import React, { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

interface LiveCountdownProps {
  targetTime: Date;
  className?: string;
}

export const LiveCountdown: React.FC<LiveCountdownProps> = ({ targetTime, className = '' }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const diff = targetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft('Game started');
        setIsUrgent(false);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Show urgent styling if less than 1 hour
      setIsUrgent(hours < 1);

      if (hours >= 24) {
        const days = Math.floor(hours / 24);
        const remainingHours = hours % 24;
        setTimeLeft(`${days}d ${remainingHours}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(interval);
  }, [targetTime]);

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Timer className={`h-4 w-4 ${isUrgent ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`} />
      <span className={`font-mono text-sm font-bold ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
        {timeLeft}
      </span>
    </div>
  );
};