"use client"

import { useMemo, useState } from "react"
import type { PropertyRow } from "@/lib/hooks/useAdminData"
import { formatMoney } from "@/lib/properties"

import { Card } from "@/components/ui/Card"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"
import { cn } from "@/lib/cn"

function spread(p: { arv: number; price: number; repairs: number }) {
  return (p.arv ?? 0) - (p.price ?? 0) - (p.repairs ?? 0)
}

type LifecycleView =
  | "all"
  | "draft"
  | "active"
  | "under_contract"
  | "closed_won"
  | "closed_lost"
  | "pending_offers"

type Props = {
  propsLoading: boolean
  properties: PropertyRow[]
  pendingCountByProperty: Map<string, number>
  onOpen: (propertyId: string) => void
  defaultLifecycle?: LifecycleView
}

function dueDiligenceStatus(ddDate: string | null | undefined): {
  label: string
  variant: "danger" | "warning" | "default"
} | null {
  if (!ddDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dd = new Date(ddDate + "T00:00:00")
  const diffDays = Math.ceil((dd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return { label: `DD ${Math.abs(diffDays)}d ago`, variant: "danger" }
  if (diffDays === 0) return { label: "DD today", variant: "danger" }
  if (diffDays <= 3) return { label: `DD in ${diffDays}d`, variant: "warning" }
  return { label: `DD in ${diffDays}d`, variant: "default" }
}

function isDraft(p: PropertyRow) {
  return !p.is_archived && p.status === "Draft"
}
function isUnderContract(p: PropertyRow) {
  return p.status === "Under Contract" && !p.is_archived
}
function isClosedWon(p: PropertyRow) {
  return !!p.is_archived && p.closed_outcome === "won"
}
function isClosedLost(p: PropertyRow) {
  return !!p.is_archived && p.closed_outcome === "lost"
}
function isActive(p: PropertyRow) {
  return !p.is_archived && p.status !== "Under Contract" && p.status !== "Draft"
}

function statusBadge(p: PropertyRow): {
  label: string
  variant: "default" | "success" | "warning" | "danger" | "outline"
} {
  if (isDraft(p)) return { label: "Draft", variant: "default" }
  if (isClosedWon(p)) return { label: "Closed Won", variant: "success" }
  if (isClosedLost(p)) return { label: "Closed Lost", variant: "warning" }
  if (isUnderContract(p)) return { label: "Under Contract", variant: "warning" }
  if (isActive(p)) return { label: "Active", variant: "outline" }
  return { label: "—", variant: "default" }
}

export default function AdminPropertiesPanel({
  propsLoading,
  properties,
  pendingCountByProperty,
  onOpen,
  defaultLifecycle = "active",
}: Props) {
  const [search, setSearch] = useState("")
  const [lifecycle, setLifecycle] = useState<LifecycleView>(defaultLifecycle)

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = properties.slice()

    if (q) list = list.filter((p) => (p.address ?? "").toLowerCase().includes(q))

    if (lifecycle !== "all") {
      list = list.filter((p) => {
        switch (lifecycle) {
          case "draft":
            return isDraft(p)
          case "active":
            return isActive(p)
          case "under_contract":
            return isUnderContract(p)
          case "closed_won":
            return isClosedWon(p)
          case "closed_lost":
            return isClosedLost(p)
          case "pending_offers":
            return (pendingCountByProperty.get(p.id) ?? 0) > 0
          default:
            return true
        }
      })
    }

    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return list
  }, [properties, search, lifecycle, pendingCountByProperty])

  const clearFilters = () => {
    setSearch("")
    setLifecycle("all")
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Properties</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">
              {propsLoading ? "Loading…" : `${properties.length} total • ${filteredAndSorted.length} shown`}
            </div>
          </div>

          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address…"
          />

          <Select value={lifecycle} onChange={(e) => setLifecycle(e.target.value as LifecycleView)}>
            <option value="active">Filter: Active</option>
            <option value="draft">Filter: Drafts</option>
            <option value="under_contract">Filter: Under Contract</option>
            <option value="closed_won">Filter: Closed Won</option>
            <option value="closed_lost">Filter: Closed Lost</option>
            <option value="pending_offers">Filter: Pending Offers</option>
            <option value="all">Filter: All</option>
          </Select>
        </div>

        <div className="mt-3 text-[11px] text-[var(--muted)]">
          Tip: use “Pending Offers” to find deals needing action fast.
        </div>
      </div>

      {propsLoading ? (
        <div className="p-4 text-sm text-[var(--muted)]">Loading properties…</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="p-4 text-sm text-[var(--muted)]">No matches. Try clearing filters.</div>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {filteredAndSorted.map((p) => {
            const pendingForProp = pendingCountByProperty.get(p.id) ?? 0
            const s = statusBadge(p)
            const dd = isActive(p) ? dueDiligenceStatus(p.due_diligence_date) : null
            const needsSetup = isDraft(p)

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpen(p.id)}
                className={cn(
                  "w-full text-left transition",
                  "hover:bg-[var(--surface)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                )}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-[var(--text)]">{p.address}</div>

                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {p.beds} bd • {p.baths} ba • {formatMoney(p.price)}
                      </div>

                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Spread:{" "}
                        <span className="font-semibold text-[var(--text)]">
                          {formatMoney(spread(p))}
                        </span>
                      </div>

                      {(pendingForProp > 0 || dd || needsSetup) && (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {needsSetup && (
                            <Badge variant="muted" title="Draft — not visible to buyers">
                              Needs publish
                            </Badge>
                          )}
                          {pendingForProp > 0 && (
                            <Badge variant="accent" title="Pending offers">
                              {pendingForProp} pending offer{pendingForProp === 1 ? "" : "s"}
                            </Badge>
                          )}
                          {dd && (
                            <Badge variant={dd.variant} title="Due diligence date">
                              {dd.label}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Badge variant={s.variant}>{s.label}</Badge>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </Card>
  )
}