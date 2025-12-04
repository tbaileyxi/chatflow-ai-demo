import React from 'react';
import { format, isToday, isYesterday } from 'date-fns';

interface DateDividerProps {
  date: Date;
}

export const DateDivider: React.FC<DateDividerProps> = ({ date }) => {
  const formatDateLabel = (date: Date): string => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'EEEE, MMMM d'); // "Wednesday, December 4"
  };

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm text-center py-2 border-b border-team-primary/20 -mx-2 sm:-mx-4 px-2 sm:px-4">
      <span className="text-sm font-bold text-yellow-400">
        {formatDateLabel(date)}
      </span>
    </div>
  );
};
