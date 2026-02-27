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
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
              Off-Market Properties
            </div>
            <h1 className="text-xl font-bold leading-tight">Browse Deals</h1>
          </div>
          {!loading && properties.length > 0 && (
            <div className="shrink-0 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text)]">
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
