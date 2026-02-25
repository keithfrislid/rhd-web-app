import * as React from "react"
import { cn } from "@/lib/cn"

type Props = {
  title?: string
  description?: string
  right?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}

export function ModalShell({
  title,
  description,
  right,
  children,
  footer,
  className,
}: Props) {
  return (
    <div
      className={cn(
        "w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl",
        className
      )}
    >
      {(title || description || right) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-4">
          <div className="min-w-0">
            {title && (
              <div className="text-base font-semibold text-[var(--text)]">
                {title}
              </div>
            )}
            {description && (
              <div className="mt-1 text-sm text-[var(--muted)]">
                {description}
              </div>
            )}
          </div>
          {right && <div className="shrink-0">{right}</div>}
        </div>
      )}

      <div className="p-4">{children}</div>

      {footer && (
        <div className="border-t border-[var(--border)] p-4">{footer}</div>
      )}
    </div>
  )
}
