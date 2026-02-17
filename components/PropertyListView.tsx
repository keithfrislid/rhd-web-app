"use client"

import { useEffect, useMemo, useState } from "react"
import DealSheetPanel from "@/components/DealSheetPanel"
import { fetchProperties, formatMoney, type Property } from "@/lib/properties"
import { supabase } from "@/lib/supabase"

type SortMode = "newest" | "price" | "spread"
type FilterMode = "all" | "saved"

function calcSpread(p: Property) {
  return p.arv - p.price - p.repairs
}

export default function PropertyListView() {
  const [selected, setSelected] = useState<Property | null>(null)
  const [sortMode, setSortMode] = useState<SortMode>("newest")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")

  const [loading, setLoading] = useState(true)
  const [propertiesRaw, setPropertiesRaw] = useState<Property[]>([])

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [savedLoading, setSavedLoading] = useState(true)

  // Load properties
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const rows = await fetchProperties()
      setPropertiesRaw(rows)
      setLoading(false)
    }
    run()
  }, [])

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

  useEffect(() => {
    loadSavedIds()

    // Refresh savedIds when deal sheet saves/unsaves
    const handler = () => loadSavedIds()
    window.addEventListener("rhd:saves-changed", handler)

    // Also refresh when user tabs away/back
    const visHandler = () => {
      if (document.visibilityState === "visible") loadSavedIds()
    }
    document.addEventListener("visibilitychange", visHandler)

    return () => {
      window.removeEventListener("rhd:saves-changed", handler)
      document.removeEventListener("visibilitychange", visHandler)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const properties = useMemo(() => {
    // filter
    const filtered =
      filterMode === "saved"
        ? propertiesRaw.filter((p) => savedIds.has(p.id))
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
  }, [propertiesRaw, sortMode, filterMode, savedIds])

  const activeCountLabel = loading
    ? "Loading…"
    : filterMode === "saved"
    ? `${properties.length} saved`
    : `${properties.length} active`

  return (
    <div className="relative">
      <div className="rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-white/10 bg-white/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Properties</div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs text-white/60">{activeCountLabel}</div>

              <div className="h-4 w-px bg-white/10" />

              {/* Filter */}
              <div className="flex items-center gap-1 rounded-lg border border-white/15 bg-black/40 p-0.5">
                <button
                  onClick={() => setFilterMode("all")}
                  className={`rounded-md px-2 py-1 text-xs ${
                    filterMode === "all"
                      ? "bg-white text-black"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setFilterMode("saved")}
                  className={`rounded-md px-2 py-1 text-xs ${
                    filterMode === "saved"
                      ? "bg-white text-black"
                      : "text-white/70 hover:bg-white/10"
                  }`}
                >
                  Saved
                </button>
              </div>

              <div className="h-4 w-px bg-white/10" />

              {/* Sort */}
              <label className="text-xs text-white/60">Sort</label>
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as SortMode)}
                className="rounded-lg border border-white/15 bg-black/40 px-2 py-1 text-xs text-white outline-none hover:bg-black/60"
              >
                <option value="newest">Newest</option>
                <option value="price">Price (low → high)</option>
                <option value="spread">Spread (high → low)</option>
              </select>
            </div>
          </div>

          {savedLoading && (
            <div className="mt-1 text-[11px] text-white/50">
              Syncing saved…
            </div>
          )}
        </div>

        {/* Body */}
        {loading ? (
          <div className="p-4 text-sm text-white/70">Loading properties…</div>
        ) : propertiesRaw.length === 0 ? (
          <div className="p-4 text-sm text-white/70">
            No properties found in Supabase.
          </div>
        ) : properties.length === 0 && filterMode === "saved" ? (
          <div className="p-4 text-sm text-white/70">
            No saved properties yet. Open a deal and hit <span className="font-semibold">Save</span>.
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {properties.map((p) => {
              const spread = calcSpread(p)
              const isSaved = savedIds.has(p.id)

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelected(p)}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/5 transition"
                >
                  {/* Top: Address + pills | Spread */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="font-semibold leading-snug truncate">
                          {p.address}
                        </div>

                        {p.status === "New" && (
                          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-red-600/90 border border-red-400/40 text-white font-semibold">
                            New
                          </span>
                        )}

                        {isSaved && (
                          <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-white/10 border border-white/15 text-white/80 font-semibold">
                            Saved
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 text-[12px] text-white/70">
                        {p.beds} bd • {p.baths} ba • {p.sqft.toLocaleString()} sqft •{" "}
                        {p.acres} ac
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-[11px] text-white/60">Spread</div>
                      <div className="text-sm font-extrabold">
                        {formatMoney(spread)}
                      </div>
                    </div>
                  </div>

                  {/* Chips: Price / Repairs / ARV */}
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                      <div className="text-[10px] text-white/60">Price</div>
                      <div className="text-[12px] font-semibold">
                        {formatMoney(p.price)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                      <div className="text-[10px] text-white/60">Repairs</div>
                      <div className="text-[12px] font-semibold">
                        {formatMoney(p.repairs)}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-white/5 px-2 py-1.5">
                      <div className="text-[10px] text-white/60">ARV</div>
                      <div className="text-[12px] font-semibold">
                        {formatMoney(p.arv)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-1.5 text-[10px] text-white/60">
                    Tap to open deal sheet →
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Deal sheet overlay */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-4 md:left-auto md:top-24 md:bottom-auto md:w-[420px] z-[3000] pointer-events-auto">
          <div className="mx-3 md:mx-0">
            <DealSheetPanel selected={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
