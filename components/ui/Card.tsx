import * as React from "react"
import { cn } from "@/lib/cn"

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm",
        className
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: CardProps) {
  return <div className={cn("p-4 pb-2", className)} {...props} />
}

export function CardContent({ className, ...props }: CardProps) {
  return <div className={cn("p-4 pt-2", className)} {...props} />
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
