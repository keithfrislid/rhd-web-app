import * as React from "react"
import { cn } from "@/lib/cn"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const base =
  "h-9 w-full rounded-lg bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)] border border-[var(--border)] transition-colors focus:outline-none focus:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]"

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(base, className)} {...props} />
  }
)

Input.displayName = "Input"
