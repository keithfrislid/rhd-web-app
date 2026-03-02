import * as React from "react"
import { cn } from "@/lib/cn"

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const base =
  "h-9 w-full rounded-lg bg-[var(--surface-2)] px-3 text-[13px] text-[var(--text)] border border-[var(--border)] transition-colors focus:outline-none focus:border-[var(--accent)]/50 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--background)]"

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select ref={ref} className={cn(base, className)} {...props}>
        {children}
      </select>
    )
  }
)

Select.displayName = "Select"
