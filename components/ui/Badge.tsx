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
    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none"

  const variants: Record<BadgeVariant, string> = {
    default: "bg-white/10 text-[var(--text)]",
    muted: "bg-white/5 text-[var(--muted)]",
    accent: "bg-[var(--accent)]/15 text-[var(--accent)]",
    success: "bg-[var(--success)]/15 text-[var(--success)]",
    warning: "bg-[var(--warn)]/15 text-[var(--warn)]",
    danger: "bg-[var(--danger)]/15 text-[var(--danger)]",
    outline: "border border-[var(--border)] text-[var(--text)]",
  }

  return <span className={cn(base, variants[variant], className)} {...props} />
}