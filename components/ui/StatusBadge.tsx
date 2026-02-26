"use client"

import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"

export type StatusBadgeKind =
  | "new"
  | "saved"
  | "viewed"
  | "under_contract"
  | "offer_pending"
  | "offer_accepted"
  | "offer_rejected"

export function StatusBadge({
  kind,
  className,
}: {
  kind: StatusBadgeKind
  className?: string
}) {
  // Keep labels centralized so later polish is 1 edit.
  if (kind === "new") {
    // You’ve been using a “red but pops” look. Keep it consistent.
    return (
      <Badge
        variant="danger"
        className={cn(
          "bg-[var(--danger)] text-black border border-[var(--danger)]/40",
          className
        )}
      >
        New
      </Badge>
    )
  }

  if (kind === "saved") return <Badge variant="muted" className={className}>Saved</Badge>
  if (kind === "viewed") return <Badge variant="muted" className={className}>Viewed</Badge>

  if (kind === "under_contract") return <Badge variant="warning" className={className}>Under Contract</Badge>

  if (kind === "offer_pending") return <Badge variant="accent" className={className}>Pending</Badge>
  if (kind === "offer_accepted") return <Badge variant="success" className={className}>Accepted</Badge>
  return <Badge variant="muted" className={className}>Rejected</Badge>
}