import React, { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface GlassHeaderProps {
  title?: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
  teamLogo?: string;
  className?: string;
}

export const GlassHeader = ({
  title,
  subtitle,
  leftAction,
  rightAction,
  onBack,
  showBack = true,
  teamLogo,
  className
}: GlassHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <header className={cn(
      "glass-header sticky top-0 z-50 px-4 py-3",
      "flex items-center justify-between gap-3",
      "min-h-[60px] safe-area-inset-top",
      className
    )}>
      {/* Left side */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {leftAction || (showBack && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </Button>
        ))}
        
        {teamLogo && (
          <div className="w-8 h-8 rounded-full overflow-hidden bg-muted shrink-0">
            <img 
              src={teamLogo} 
              alt="Team" 
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        <div className="min-w-0 flex-1">
          {title && (
            <h1 className="font-semibold text-foreground text-lg leading-tight truncate">
              {title}
            </h1>
          )}
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 shrink-0">
        {rightAction || (
          <Button
            variant="ghost"
            size="sm"
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <MoreVertical className="h-5 w-5 text-foreground" />
          </Button>
        )}
      </div>
    </header>
  );
};