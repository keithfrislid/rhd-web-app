"use client"

import { useEffect, useMemo, useState } from "react"
import AdminOffersPanel from "@/components/AdminOffersPanel"
import type { PropertyRow } from "@/lib/hooks/useAdminData"
import { formatMoney } from "@/lib/properties"

import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"

function spread(p: { arv: number; price: number; repairs: number }) {
  return (p.arv ?? 0) - (p.price ?? 0) - (p.repairs ?? 0)
}

type LifecycleView =
  | "all"
  | "active"
  | "under_contract"
  | "closed_won"
  | "closed_lost"
  | "pending_offers"

type Props = {
  propsLoading: boolean
  properties: PropertyRow[]

  selectedId: string | null
  setSelectedId: (id: string | null) => void
  selected: PropertyRow | null

  pendingCountByProperty: Map<string, number>

  onEdit: (p: PropertyRow) => void
  onDelete: (propertyId: string, address: string) => void
  onClose: (p: PropertyRow, outcome: "won" | "lost") => void

  deleteBusy: string | null
  closeBusy: string | null

  onAcceptedOffer: () => void
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
  // “Active” means visible inventory that isn’t closed/archived and isn’t marked Under Contract.
  return !p.is_archived && p.status !== "Under Contract"
}

function statusBadge(p: PropertyRow): { label: string; variant: "default" | "success" | "warning" | "danger" | "outline" } {
  if (isClosedWon(p)) return { label: "Closed Won", variant: "success" }
  if (isClosedLost(p)) return { label: "Closed Lost", variant: "warning" }
  if (isUnderContract(p)) return { label: "Under Contract", variant: "warning" }
  if (isActive(p)) return { label: "Active", variant: "outline" }
  return { label: "—", variant: "default" }
}

export default function AdminPropertiesPanel({
  propsLoading,
  properties,
  selectedId,
  setSelectedId,
  selected,
  pendingCountByProperty,
  onEdit,
  onDelete,
  onClose,
  deleteBusy,
  closeBusy,
  onAcceptedOffer,
}: Props) {
  const [search, setSearch] = useState("")
  const [lifecycle, setLifecycle] = useState<LifecycleView>("all")

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = properties.slice()

    // Address search
    if (q) list = list.filter((p) => (p.address ?? "").toLowerCase().includes(q))

    // Lifecycle filter
    if (lifecycle !== "all") {
      list = list.filter((p) => {
        switch (lifecycle) {
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

    // Always Newest -> Oldest
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    return list
  }, [properties, search, lifecycle, pendingCountByProperty])

  // If current selection disappears due to filtering, select first visible.
  useEffect(() => {
    if (propsLoading) return
    if (filteredAndSorted.length === 0) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !filteredAndSorted.some((p) => p.id === selectedId)) {
      setSelectedId(filteredAndSorted[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propsLoading, filteredAndSorted])

  const clearFilters = () => {
    setSearch("")
    setLifecycle("all")
  }

  const shownLabel = propsLoading ? "Loading…" : `${filteredAndSorted.length} shown`

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
      {/* LEFT: list */}
      <Card className="overflow-hidden lg:col-span-2">
        {/* Header + Controls */}
        <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Properties</div>
              <div className="mt-0.5 text-xs text-[var(--muted)]">
                {propsLoading ? "Loading…" : `${properties.length} total • ${filteredAndSorted.length} shown`}
              </div>
            </div>

            <div className="text-xs text-[var(--muted)]">{shownLabel}</div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address…"
            />

            <Select value={lifecycle} onChange={(e) => setLifecycle(e.target.value as LifecycleView)}>
              <option value="all">Filter: All</option>
              <option value="active">Filter: Active</option>
              <option value="under_contract">Filter: Under Contract</option>
              <option value="closed_won">Filter: Closed Won</option>
              <option value="closed_lost">Filter: Closed Lost</option>
              <option value="pending_offers">Filter: Pending Offers</option>
            </Select>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="text-[11px] text-[var(--muted)]">
              Tip: use “Pending Offers” to find deals needing action fast.
            </div>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          </div>
        </div>

        {/* Body */}
        {propsLoading ? (
          <div className="p-4 text-sm text-[var(--muted)]">Loading properties…</div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-4 text-sm text-[var(--muted)]">No matches. Try clearing filters.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {filteredAndSorted.map((p) => {
              const active = p.id === selectedId
              const pendingForProp = pendingCountByProperty.get(p.id) ?? 0
              const s = statusBadge(p)

              return (
                <div
                  key={p.id}
                  className={cn(
                    "p-4 transition",
                    active ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface)]"
                  )}
                >
                  <button type="button" onClick={() => setSelectedId(p.id)} className="w-full text-left">
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

                        {pendingForProp > 0 && (
                          <div className="mt-2">
                            <Badge variant="accent" title="Pending offers">
                              {pendingForProp} pending offer{pendingForProp === 1 ? "" : "s"}
                            </Badge>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </div>
                    </div>
                  </button>

                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-[11px] text-[var(--muted)]">
                      ID: {p.id.slice(0, 6)}…{p.id.slice(-4)}
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Button variant="secondary" size="sm" onClick={() => onEdit(p)}>
                        Edit
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onClose(p, "won")}
                        disabled={closeBusy === p.id}
                        title="Close Won (Sold/Assigned) — archives and hides from buyers"
                      >
                        {closeBusy === p.id ? "Closing…" : "Close Won"}
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onClose(p, "lost")}
                        disabled={closeBusy === p.id}
                        title="Close Lost (DD expired/Cancelled) — archives and hides from buyers"
                      >
                        {closeBusy === p.id ? "Closing…" : "Close Lost"}
                      </Button>

                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => onDelete(p.id, p.address)}
                        disabled={deleteBusy === p.id}
                      >
                        {deleteBusy === p.id ? "Deleting…" : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* RIGHT: offers */}
      <div className="lg:col-span-3">
        {selected ? (
          <AdminOffersPanel
            propertyId={selected.id}
            propertyAddress={selected.address}
            onAccepted={onAcceptedOffer}
          />
        ) : (
          <Card className="p-6">
            <div className="text-sm text-[var(--muted)]">Select a property to view offers.</div>
          </Card>
        )}
      </div>
    </div>
  )
}