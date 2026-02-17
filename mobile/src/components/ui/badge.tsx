import { View, Text, type ViewProps } from "react-native";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  outline: "border border-border bg-transparent",
} as const;

const variantTextStyles = {
  default: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  destructive: "text-destructive-foreground",
  outline: "text-foreground",
} as const;

type BadgeProps = ViewProps & {
  variant?: keyof typeof variantStyles;
  className?: string;
  children: string;
};

export function Badge({
  variant = "default",
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <View
      className={cn(
        "items-center justify-center rounded-full px-2.5 py-0.5",
        variantStyles[variant],
        className,
      )}
      {...props}
    >
      <Text
        className={cn("text-xs font-semibold", variantTextStyles[variant])}
      >
        {children}
      </Text>
    </View>
  );
}
