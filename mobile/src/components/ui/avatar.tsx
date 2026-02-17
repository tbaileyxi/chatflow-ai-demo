import { View, Text, Image, type ImageProps } from "react-native";
import { cn } from "@/lib/utils";

type AvatarProps = {
  size?: number;
  className?: string;
  children: React.ReactNode;
};

export function Avatar({ size = 40, className, children }: AvatarProps) {
  return (
    <View
      className={cn(
        "items-center justify-center overflow-hidden rounded-full bg-muted",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {children}
    </View>
  );
}

type AvatarImageProps = Omit<ImageProps, "source"> & {
  src: string;
  className?: string;
};

export function AvatarImage({ src, className, ...props }: AvatarImageProps) {
  return (
    <Image
      source={{ uri: src }}
      className={cn("h-full w-full", className)}
      {...props}
    />
  );
}

type AvatarFallbackProps = {
  className?: string;
  children: string;
};

export function AvatarFallback({ className, children }: AvatarFallbackProps) {
  return (
    <Text
      className={cn("text-sm font-medium text-muted-foreground", className)}
    >
      {children}
    </Text>
  );
}
