import * as React from "react"
import { cn } from "@/lib/cn"

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

const base =
  "h-10 w-full rounded-lg bg-[var(--surface)] px-3 text-sm text-[var(--text)] border border-[var(--border)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"

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
