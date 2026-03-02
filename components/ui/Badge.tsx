"use client"

import * as React from "react"
import { cn } from "@/lib/cn"

export type BadgeVariant =
  | "default"
  | "muted"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline"

export function Badge({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant
}) {
  const base =
    "inline-flex items-center rounded-full px-2.5 py-[3px] text-[11px] font-semibold leading-none tracking-wide"

  const variants: Record<BadgeVariant, string> = {
    default: "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]",
    muted: "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]",
    accent: "bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent)]/20",
    success: "bg-[var(--success-dim)] text-[var(--success)] border border-[var(--success)]/20",
    warning: "bg-[var(--warning-dim)] text-[var(--warning)] border border-[var(--warning)]/20",
    danger: "bg-[var(--danger-dim)] text-[var(--danger)] border border-[var(--danger)]/20",
    outline: "border border-[var(--border-strong)] text-[var(--muted)]",
  }

  return <span className={cn(base, variants[variant], className)} {...props} />
}