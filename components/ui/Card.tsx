import * as React from "react"
import { cn } from "@/lib/cn"

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-md)]",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn("px-5 pt-5 pb-3", className)} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn("px-5 pb-5 pt-2", className)} {...props} />
}

export function CardFooter({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "p-4 pt-2 border-t border-[var(--border)] flex items-center justify-end gap-2",
        className
      )}
      {...props}
    />
  )
}
