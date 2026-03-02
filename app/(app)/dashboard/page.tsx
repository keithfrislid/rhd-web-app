"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import PropertyListView from "@/components/PropertyListView"
import { fetchProperties, type Property } from "@/lib/properties"
import { useViewedProperties } from "@/lib/hooks/useViewedProperties"

import { PageShell } from "@/components/ui/PageShell"

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
      Loading map…
    </div>
  ),
})

type ViewMode = "map" | "list"

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("map")
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setLoading(true)
      const rows = await fetchProperties({})
      if (cancelled) return
      setProperties(rows)
      setLoading(false)
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const propertyIds = useMemo(() => properties.map((p) => p.id), [properties])
  const { viewedIds, viewedLoading, markViewed, unmarkViewed } = useViewedProperties(propertyIds)

  return (
    <PageShell>
      {viewMode === "map" && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]/15 border border-[var(--accent)]/25">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                Off-Market Properties
              </div>
              <h1 className="text-[17px] font-bold leading-tight tracking-tight">Browse Deals</h1>
            </div>
          </div>
          {!loading && properties.length > 0 && (
            <div className="shrink-0 flex items-center gap-1.5 rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-[12px] font-semibold text-[var(--accent)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-pulse" />
              {properties.length} active
            </div>
          )}
        </div>
      )}

      {viewMode === "map" ? (
        <LeafletMap
          properties={properties}
          loading={loading}
          viewedIds={viewedIds}
          viewedLoading={viewedLoading}
          markViewed={markViewed}
          unmarkViewed={unmarkViewed}
          onSwitchToList={() => setViewMode("list")}
        />
      ) : (
        <PropertyListView
          properties={properties}
          loading={loading}
          viewedIds={viewedIds}
          viewedLoading={viewedLoading}
          markViewed={markViewed}
          onSwitchToMap={() => setViewMode("map")}
        />
      )}
    </PageShell>
  )
}
