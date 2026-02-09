import { Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface VerifiedBadgeProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const VerifiedBadge = ({ className, size = "md" }: VerifiedBadgeProps) => {
  const sizeClasses = {
    sm: "w-3 h-3",
    md: "w-4 h-4", 
    lg: "w-5 h-5"
  };

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <Shield 
        className={cn(
          "text-verified-primary fill-verified-primary/20", 
          sizeClasses[size]
        )} 
      />
      {size !== "sm" && (
        <span className="text-xs font-medium text-verified-primary">
          HOSTED
        </span>
      )}
    </div>
  );
};