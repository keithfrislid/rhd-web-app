import * as React from "react"
import { cn } from "@/lib/cn"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const base =
  "h-10 w-full rounded-lg bg-[var(--surface)] px-3 text-sm text-[var(--text)] placeholder:text-[var(--muted)] border border-[var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return <input ref={ref} className={cn(base, className)} {...props} />
  }
)

Input.displayName = "Input"
