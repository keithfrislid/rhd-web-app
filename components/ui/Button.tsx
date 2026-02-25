import * as React from "react"
import { cn } from "@/lib/cn"

type Variant = "primary" | "secondary" | "ghost" | "danger"
type Size = "sm" | "md" | "lg"

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
  size?: Size
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"

const variants: Record<Variant, string> = {
  primary:
    "bg-[var(--accent)] text-black hover:brightness-110 border border-transparent",
  secondary:
    "bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)]",
  ghost:
    "bg-transparent text-[var(--text)] hover:bg-[var(--surface)] border border-transparent",
  danger:
    "bg-[var(--danger)] text-black hover:brightness-110 border border-transparent",
}

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
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
