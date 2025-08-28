import * as React from "react"
import { Button, ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface AnimatedButtonProps extends ButtonProps {
  animation?: "scale" | "glow" | "float" | "shimmer"
  glowColor?: string
}

export const AnimatedButton = React.forwardRef<
  HTMLButtonElement,
  AnimatedButtonProps
>(({ className, animation = "scale", glowColor, children, ...props }, ref) => {
  const animationClasses = {
    scale: "hover:scale-105 active:scale-95 transition-transform duration-200",
    glow: "animate-pulse-glow hover:shadow-lg",
    float: "hover:animate-float",
    shimmer: "relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent before:animate-shimmer hover:before:block"
  }

  return (
    <Button
      ref={ref}
      className={cn(
        "transition-all duration-300 ease-out button-shadow",
        animationClasses[animation],
        glowColor && `hover:shadow-[0_0_20px_${glowColor}]`,
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
})
AnimatedButton.displayName = "AnimatedButton"