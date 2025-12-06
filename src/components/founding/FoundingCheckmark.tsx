import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FoundingCheckmarkProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function FoundingCheckmark({ className, size = 'md' }: FoundingCheckmarkProps) {
  const sizeClasses = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center justify-center rounded-full bg-blue-500',
        sizeClasses[size],
        className
      )}
      title="Founding Member 2025"
    >
      <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
    </div>
  );
}
