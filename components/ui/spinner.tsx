import * as React from "react"
import { cn } from "@/lib/utils"

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg"
}

/**
 * Radix UI styled spinner component
 * Uses Radix UI design patterns with smooth animations
 */
export function Spinner({ className, size = "md", ...props }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-2",
    lg: "h-12 w-12 border-[3px]",
  }

  return (
    <div
      className={cn(
        "relative inline-block",
        "rounded-full",
        "border-solid",
        "border-t-transparent border-r-current border-b-current border-l-current",
        "animate-spin",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading"
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

