import * as React from "react"
import { cn } from "@/lib/cn"

type Props = {
  children: React.ReactNode
  className?: string
  maxWidth?: "md" | "lg" | "xl"
}

const widths: Record<NonNullable<Props["maxWidth"]>, string> = {
  md: "max-w-4xl",
  lg: "max-w-5xl",
  xl: "max-w-6xl",
}

export function PageShell({ children, className, maxWidth = "lg" }: Props) {
  return (
    <div className={cn("mx-auto w-full px-4 py-4", widths[maxWidth], className)}>
      {children}
    </div>
  )
}
