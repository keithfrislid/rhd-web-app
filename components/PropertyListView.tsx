"use client"

import { useEffect, useMemo, useState } from "react"
import DealSheetPanel from "@/components/DealSheetPanel"
import { effectiveVisibility, formatMoney, type Property } from "@/lib/properties"
import { supabase } from "@/lib/supabase"
import { cn } from "@/lib/cn"

import { Card, CardContent, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Select } from "@/components/ui/Select"
import { StatusBadge } from "@/components/ui/StatusBadge"

type SortMode = "newest" | "price" | "spread"
type FilterMode = "all" | "saved" | "pending"

function calcSpread(p: Property) {
  return p.arv - p.price - p.repairs
}

function formatCountdown(targetIso: string | null | undefined): string | null {
  if (!targetIso) return null
  const target = new Date(targetIso).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - Date.now()
  if (diff <= 0) return null
  const totalSecs = Math.floor(diff / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export default function PropertyListView({
  properties: propertiesRaw,
  loading,
  viewedIds,
  viewedLoading,
  markViewed,
  onSwitchToMap,
}: {
  properties: Property[]
  loading: boolean
  viewedIds: Set<string>
  viewedLoading: boolean
  markViewed: (propertyId: string) => void | Promise<void>
  onSwitchToMap?: () => void
}) {
  const [selected, setSelected] = useState<Property | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("newest")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedLoading, setSavedLoading] = useState(true)

  const [pendingOfferIds, setPendingOfferIds] = useState<Set<string>>(new Set())
  const [pendingLoading, setPendingLoading] = useState(true)

  const [acceptedOfferIds, setAcceptedOfferIds] = useState<Set<string>>(new Set())
  const [acceptedLoading, setAcceptedLoading] = useState(true)

  // Tick every second to drive countdown timers for exclusive/VIP properties
  const [, setTick] = useState(0)
  useEffect(() => {
    const hasTimedProps = propertiesRaw.some(
      (p) => p.visibility === "exclusive" || p.visibility === "vip"
    )
    if (!hasTimedProps) return
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [propertiesRaw])

  // Load saved property ids for this user
  const loadSavedIds = async () => {
    setSavedLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSavedIds(new Set())
      setSavedLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("saved_properties")
      .select("property_id")
      .eq("user_id", user.id)

    if (error) {
      console.warn("Failed to load saved_properties:", error.message)
      setSavedIds(new Set())
      setSavedLoading(false)
      return
    }

    const ids = new Set((data ?? []).map((r: any) => r.property_id as string))
    setSavedIds(ids)
    setSavedLoading(false)
  }

  // Load pending offer property ids for this user
  const loadPendingOfferIds = async () => {
    setPendingLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setPendingOfferIds(new Set())
      setPendingLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("offers")
      .select("property_id,status")
      .eq("user_id", user.id)
      .eq("status", "pending")

    if (error) {
      console.warn("Failed to load offers:", error.message)
      setPendingOfferIds(new Set())
      setPendingLoading(false)
      return
    }

    const ids = new Set((data ?? []).map((r: any) => r.property_id as string))
    setPendingOfferIds(ids)
    setPendingLoading(false)
  }

  const loadAcceptedOfferIds = async () => {
    setAcceptedLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setAcceptedOfferIds(new Set())
      setAcceptedLoading(false)
      return
    }

    const { data, error } = await supabase
      .from("offers")
      .select("property_id")
      .eq("user_id", user.id)
      .eq("status", "accepted")

    if (error) {
      console.warn("Failed to load accepted offers:", error.message)
      setAcceptedOfferIds(new Set())
      setAcceptedLoading(false)
      return
    }

    setAcceptedOfferIds(new Set((data ?? []).map((r: any) => r.property_id as string)))
    setAcceptedLoading(false)
  }

  useEffect(() => {
    loadSavedIds()
    loadPendingOfferIds()
    loadAcceptedOfferIds()

    // Refresh when deal sheet saves/unsaves
    const savesHandler = () => loadSavedIds()
    window.addEventListener("rhd:saves-changed", savesHandler)

    // Refresh when offers change (submit / delete)
    const offersHandler = () => loadPendingOfferIds()
    window.addEventListener("rhd:offers-changed", offersHandler)

    // Also refresh when user tabs away/back
    const visHandler = () => {
      if (document.visibilityState === "visible") {
        loadSavedIds()
        loadPendingOfferIds()
      }
    }
    document.addEventListener("visibilitychange", visHandler)

    return () => {
      window.removeEventListener("rhd:saves-changed", savesHandler)
      window.removeEventListener("rhd:offers-changed", offersHandler)
      document.removeEventListener("visibilitychange", visHandler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const properties = useMemo(() => {
    // filter
    const filtered =
      filterMode === "saved"
        ? propertiesRaw.filter((p) => savedIds.has(p.id))
        : filterMode === "pending"
        ? propertiesRaw.filter((p) => pendingOfferIds.has(p.id))
        : propertiesRaw

    // sort
    const copy = [...filtered]
    copy.sort((a, b) => {
      const spreadA = calcSpread(a)
      const spreadB = calcSpread(b)

      if (sortMode === "price") return a.price - b.price
      if (sortMode === "spread") return spreadB - spreadA

      // newest: New at top, then higher spread
      const aNew = a.status === "New" ? 1 : 0
      const bNew = b.status === "New" ? 1 : 0
      if (bNew !== aNew) return bNew - aNew
      return spreadB - spreadA
    })

    return copy
  }, [propertiesRaw, sortMode, filterMode, savedIds, pendingOfferIds])

  const activeCountLabel = loading
    ? "Loading…"
    : filterMode === "saved"
    ? `${properties.length} saved`
    : filterMode === "pending"
    ? `${properties.length} pending`
    : `${properties.length} active`

  return (
    <div className="relative">
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">Properties</div>

              {onSwitchToMap && (
                <div className="flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                  <button
                    onClick={onSwitchToMap}
                    className="px-3 py-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--text)] transition-colors"
                  >
                    Map
                  </button>
                  <div className="w-px h-4 bg-[var(--border)]" />
                  <span className="px-3 py-1 text-xs font-semibold text-[var(--text)] select-none">List</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="muted">{activeCountLabel}</Badge>

              <div className="h-4 w-px bg-[var(--border)]" />

              {/* Filter */}
              <div className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1">
                <Button
                  size="sm"
                  variant={filterMode === "all" ? "primary" : "ghost"}
                  onClick={() => setFilterMode("all")}
                  className="h-8 px-2"
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === "saved" ? "primary" : "ghost"}
                  onClick={() => setFilterMode("saved")}
                  className="h-8 px-2"
                >
                  Saved
                </Button>
                <Button
                  size="sm"
                  variant={filterMode === "pending" ? "primary" : "ghost"}
                  onClick={() => setFilterMode("pending")}
                  className="h-8 px-2"
                >
                  Pending
                </Button>
              </div>

              <div className="h-4 w-px bg-[var(--border)]" />

              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--muted)]">Sort</span>
                <Select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="h-9 w-[190px] px-2 text-xs"
                >
                  <option value="newest">Newest</option>
                  <option value="price">Price (low → high)</option>
                  <option value="spread">Spread (high → low)</option>
                </Select>
              </div>
            </div>
          </div>

          {(savedLoading || pendingLoading || acceptedLoading) && (
            <div className="mt-1 text-[11px] text-[var(--muted)]">
              Syncing{" "}
              {savedLoading && pendingLoading
                ? "saved + pending…"
                : savedLoading
                ? "saved…"
                : pendingLoading
                ? "pending…"
                : "accepted…"}
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {/* Body */}
          {loading ? (
            <div className="p-4 text-sm text-[var(--muted)]">Loading properties…</div>
          ) : propertiesRaw.length === 0 ? (
            <div className="p-4 text-sm text-[var(--muted)]">
              No properties found in Supabase.
            </div>
          ) : properties.length === 0 && filterMode === "saved" ? (
            <div className="p-4 text-sm text-[var(--muted)]">
              No saved properties yet. Open a deal and hit{" "}
              <span className="font-semibold text-[var(--text)]">Save</span>.
            </div>
          ) : properties.length === 0 && filterMode === "pending" ? (
            <div className="p-4 text-sm text-[var(--muted)]">
              No pending offers yet. Open a deal and submit an offer.
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {properties.map((p) => {
                const spread = calcSpread(p)
                const isSaved = savedIds.has(p.id)
                const isPending = pendingOfferIds.has(p.id)
                const isAccepted = acceptedOfferIds.has(p.id)

                const visEff = effectiveVisibility(p)

                const showNew =
                  p.status === "New" &&
                  !viewedLoading &&
                  !viewedIds.has(p.id) &&
                  visEff === "public"

                const countdownTarget =
                  visEff === "exclusive"
                    ? p.vipReleaseAt
                    : visEff === "vip"
                    ? p.publicReleaseAt
                    : null
                const countdown = formatCountdown(countdownTarget)

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelected(p)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition",
                      "hover:bg-[var(--surface-2)]"
                    )}
                  >
                    {/* Top: Address + pills | Spread */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="min-w-0 truncate font-semibold leading-snug text-[var(--text)]">
                            {p.address}
                          </div>

                          {visEff === "exclusive" && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                              First Dibs
                            </span>
                          )}

                          {visEff === "vip" && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-yellow-400/40 bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-500">
                              VIP Access
                            </span>
                          )}

                          {showNew && <StatusBadge kind="new" className="shrink-0" />}

                          {isSaved && <StatusBadge kind="saved" className="shrink-0" />}

                          {isPending && <StatusBadge kind="offer_pending" className="shrink-0" />}

                          {isAccepted && <StatusBadge kind="offer_accepted" className="shrink-0" />}

                          {p.status === "Under Contract" && (
                            <StatusBadge kind="under_contract" className="shrink-0" />
                          )}
                        </div>

                        <div className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {p.beds} bd • {p.baths} ba • {p.sqft.toLocaleString()} sqft •{" "}
                          {p.acres} ac
                        </div>

                        {countdown && (
                          <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                            <span className={visEff === "exclusive" ? "text-purple-400" : "text-yellow-500"}>⏱</span>
                            <span className="text-[var(--muted)]">
                              {visEff === "exclusive" ? "First Dibs" : "VIP Access"} ends in
                            </span>
                            <span className={`font-semibold tabular-nums ${visEff === "exclusive" ? "text-purple-400" : "text-yellow-500"}`}>
                              {countdown}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-right">
                        <div className="text-[11px] text-[var(--muted)]">Spread</div>
                        <div className="text-sm font-extrabold text-[var(--text)]">
                          {formatMoney(spread)}
                        </div>
                      </div>
                    </div>

                    {/* Chips: Price / Repairs / ARV */}
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
                        <div className="text-[10px] text-[var(--muted)]">Price</div>
                        <div className="text-[12px] font-semibold text-[var(--text)]">
                          {formatMoney(p.price)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
                        <div className="text-[10px] text-[var(--muted)]">Repairs</div>
                        <div className="text-[12px] font-semibold text-[var(--text)]">
                          {formatMoney(p.repairs)}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5">
                        <div className="text-[10px] text-[var(--muted)]">ARV</div>
                        <div className="text-[12px] font-semibold text-[var(--text)]">
                          {formatMoney(p.arv)}
                        </div>
                      </div>
                    </div>

                    <div className="mt-1.5 text-[10px] text-[var(--muted)]">
                      Tap to open deal sheet →
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deal sheet overlay */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-4 md:left-auto md:top-24 md:bottom-auto md:w-[420px] z-[3000] pointer-events-auto">
          <div className="mx-3 md:mx-0">
            <DealSheetPanel
              selected={selected}
              onClose={() => {
                markViewed(selected.id)
                setSelected(null)
              }}
              isViewed={viewedIds.has(selected.id)}
            />
          </div>
        </div>
      )}
    </div>
  )
}