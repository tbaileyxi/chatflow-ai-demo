import { Pressable, Text, type PressableProps } from "react-native";
import { cn } from "@/lib/utils";

const variantStyles = {
  default: "bg-primary active:opacity-80",
  destructive: "bg-destructive active:opacity-80",
  outline: "border border-border bg-transparent active:bg-muted",
  secondary: "bg-secondary active:opacity-80",
  ghost: "bg-transparent active:bg-muted",
} as const;

const variantTextStyles = {
  default: "text-primary-foreground",
  destructive: "text-destructive-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
} as const;

const sizeStyles = {
  xs: "h-7 px-2 rounded-sm",
  default: "h-10 px-4 rounded-md",
  sm: "h-9 px-3 rounded-md",
  lg: "h-12 px-6 rounded-lg",
  icon: "h-10 w-10 rounded-md items-center justify-center",
} as const;

const sizeTextStyles = {
  xs: "text-xs",
  default: "text-sm",
  sm: "text-sm",
  lg: "text-base",
  icon: "text-sm",
} as const;

type ButtonProps = PressableProps & {
  variant?: keyof typeof variantStyles;
  size?: keyof typeof sizeStyles;
  className?: string;
  textClassName?: string;
  children: React.ReactNode;
};

export function Button({
  variant = "default",
  size = "default",
  className,
  textClassName,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <Pressable
      className={cn(
        "flex-row items-center justify-center",
        variantStyles[variant],
        sizeStyles[size],
        disabled && "opacity-50",
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {typeof children === "string" ? (
        <Text
          className={cn(
            "font-semibold",
            variantTextStyles[variant],
            sizeTextStyles[size],
            textClassName,
          )}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  );
}
