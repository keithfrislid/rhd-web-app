"use client"

import { Badge } from "@/components/ui/Badge"

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
  // Use Badge variants to get the “tinted pill” look everywhere:
  // red-on-red, blue-on-blue, green-on-green, etc.
  if (kind === "new") {
    return (
      <Badge variant="danger" className={className}>
        New
      </Badge>
    )
  }

  if (kind === "saved") {
    return (
      <Badge variant="muted" className={className}>
        Saved
      </Badge>
    )
  }

  if (kind === "viewed") {
    return (
      <Badge variant="muted" className={className}>
        Viewed
      </Badge>
    )
  }

  if (kind === "under_contract") {
    return (
      <Badge variant="warning" className={className}>
        Under Contract
      </Badge>
    )
  }

  if (kind === "offer_pending") {
    return (
      <Badge variant="accent" className={className}>
        Pending
      </Badge>
    )
  }

  if (kind === "offer_accepted") {
    return (
      <Badge variant="success" className={className}>
        Accepted
      </Badge>
    )
  }

  // offer_rejected
  return (
    <Badge variant="danger" className={className}>
      Rejected
    </Badge>
  )
}