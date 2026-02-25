import * as React from "react"
import { cn } from "@/lib/cn"

type Props = {
  title: string
  subtitle?: string
  right?: React.ReactNode
  className?: string
}

export function SectionHeader({ title, subtitle, right, className }: Props) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-[var(--text)]">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  )
}
