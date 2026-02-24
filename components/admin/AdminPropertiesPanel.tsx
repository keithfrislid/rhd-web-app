"use client"

import { useEffect, useMemo, useState } from "react"
import AdminOffersPanel from "@/components/AdminOffersPanel"
import type { PropertyRow } from "@/lib/hooks/useAdminData"
import { formatMoney } from "@/lib/properties"

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
    if (q) {
      list = list.filter((p) => (p.address ?? "").toLowerCase().includes(q))
    }

    // Lifecycle “Sort” dropdown
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
    list.sort((a, b) => {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })

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
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-2 rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-white/5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">Properties</div>
              <div className="text-xs text-white/60">{shownLabel}</div>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search address…"
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/30"
              />

              <select
                value={lifecycle}
                onChange={(e) => setLifecycle(e.target.value as LifecycleView)}
                className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="all">Sort: All</option>
                <option value="active">Sort: Active</option>
                <option value="under_contract">Sort: Under Contract</option>
                <option value="closed_won">Sort: Closed Won</option>
                <option value="closed_lost">Sort: Closed Lost</option>
                <option value="pending_offers">Sort: Pending Offers</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-xs text-white/50">
                {propsLoading
                  ? "Loading…"
                  : `${properties.length} total • ${filteredAndSorted.length} shown`}
              </div>

              <button
                onClick={clearFilters}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-1.5 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition"
                type="button"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        {propsLoading ? (
          <div className="p-4 text-sm text-white/70">Loading properties…</div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="p-4 text-sm text-white/70">No matches. Try clearing filters.</div>
        ) : (
          <div className="divide-y divide-white/10">
            {filteredAndSorted.map((p) => {
              const active = p.id === selectedId
              const pendingForProp = pendingCountByProperty.get(p.id) ?? 0

              const badge = isClosedWon(p)
                ? {
                    label: "Closed Won",
                    cls: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
                  }
                : isClosedLost(p)
                  ? {
                      label: "Closed Lost",
                      cls: "border-amber-400/25 bg-amber-500/10 text-amber-200",
                    }
                  : isUnderContract(p)
                    ? {
                        label: "Under Contract",
                        cls: "border-orange-400/25 bg-orange-500/10 text-orange-200",
                      }
                    : { label: "Active", cls: "border-white/15 bg-black/30 text-white/70" }

              return (
                <div
                  key={p.id}
                  className={`px-4 py-3 transition ${active ? "bg-white/10" : "hover:bg-white/5"}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{p.address}</div>

                        <div className="mt-0.5 text-xs text-white/60">
                          {p.beds} bd • {p.baths} ba • {formatMoney(p.price)}
                        </div>

                        <div className="mt-1 text-xs text-white/60">
                          Spread:{" "}
                          <span className="text-white/80 font-semibold">
                            {formatMoney(spread(p))}
                          </span>
                        </div>

                        {pendingForProp > 0 && (
                          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200">
                            {pendingForProp} pending offer{pendingForProp === 1 ? "" : "s"}
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span
                          className={`text-[11px] rounded-full border px-2 py-1 font-semibold ${badge.cls}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                    </div>
                  </button>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="text-[11px] text-white/50">
                      ID: {p.id.slice(0, 6)}…{p.id.slice(-4)}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button
                        onClick={() => onEdit(p)}
                        className="rounded-xl px-3 py-1.5 text-xs font-semibold border border-sky-400/25 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15 transition"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => onClose(p, "won")}
                        disabled={closeBusy === p.id}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                          closeBusy === p.id
                            ? "border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                            : "border-emerald-400/25 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/15"
                        }`}
                        title="Close Won (Sold/Assigned) — archives and hides from buyers"
                      >
                        {closeBusy === p.id ? "Closing…" : "Close Won"}
                      </button>

                      <button
                        onClick={() => onClose(p, "lost")}
                        disabled={closeBusy === p.id}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                          closeBusy === p.id
                            ? "border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                            : "border-amber-400/25 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                        }`}
                        title="Close Lost (DD expired/Cancelled) — archives and hides from buyers"
                      >
                        {closeBusy === p.id ? "Closing…" : "Close Lost"}
                      </button>

                      <button
                        onClick={() => onDelete(p.id, p.address)}
                        disabled={deleteBusy === p.id}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                          deleteBusy === p.id
                            ? "border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                            : "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                        }`}
                      >
                        {deleteBusy === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="lg:col-span-3">
        {selected ? (
          <AdminOffersPanel
            propertyId={selected.id}
            propertyAddress={selected.address}
            onAccepted={onAcceptedOffer}
          />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Select a property to view offers.
          </div>
        )}
      </div>
    </div>
  )
}