import * as React from "react"
import { cn } from "@/lib/cn"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium tracking-[-0.01em] transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)] select-none"

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] hover:brightness-110 active:brightness-95 border border-transparent",
  secondary:
    "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-3,var(--surface-2))] active:brightness-95",
  ghost:
    "bg-transparent text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-transparent active:brightness-95",
  danger:
    "bg-[var(--danger)] text-white shadow-[0_1px_3px_rgba(0,0,0,0.35)] hover:brightness-110 active:brightness-95 border border-transparent",
}

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-[12px]",
  md: "h-9 px-4 text-[13px]",
  lg: "h-10 px-5 text-sm",
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type ?? "button"}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    )
  }
)

Button.displayName = "Button"
