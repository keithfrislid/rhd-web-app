import * as React from "react"
import { cn } from "@/lib/cn"

type Variant = "default" | "accent" | "success" | "warning" | "danger" | "outline"

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant
}

const base =
  "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold tracking-wide"

const variants: Record<Variant, string> = {
  default: "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]",
  accent: "bg-[var(--accent)] text-black",
  success: "bg-[var(--success)] text-black",
  warning: "bg-[var(--warning)] text-black",
  danger: "bg-[var(--danger)] text-black",
  outline: "bg-transparent text-[var(--text)] border border-[var(--border-strong)]",
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return <span className={cn(base, variants[variant], className)} {...props} />
}
