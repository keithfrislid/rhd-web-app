"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import PropertyListView from "@/components/PropertyListView"
import { fetchProperties, type Property } from "@/lib/properties"
import { useViewedProperties } from "@/lib/hooks/useViewedProperties"

import { PageShell } from "@/components/ui/PageShell"
import { Card, CardContent } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"

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
  const { viewedIds, viewedLoading, markViewed } = useViewedProperties(propertyIds)

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Browse Deals</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Map-first browsing with compact investor list view.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              className={
                viewMode === "map"
                  ? "bg-[var(--surface-2)] text-[var(--text)] border-[var(--border-strong)]"
                  : "bg-[var(--surface)] text-[var(--muted)]"
              }
              onClick={() => setViewMode("map")}
            >
              Map
            </Button>

            <Button
              variant="secondary"
              size="sm"
              className={
                viewMode === "list"
                  ? "bg-[var(--surface-2)] text-[var(--text)] border-[var(--border-strong)]"
                  : "bg-[var(--surface)] text-[var(--muted)]"
              }
              onClick={() => setViewMode("list")}
            >
              List
            </Button>
          </div>

        </div>
      </div>

      <div className="mt-6">
        {viewMode === "map" ? (
          <LeafletMap
            properties={properties}
            loading={loading}
            viewedIds={viewedIds}
            viewedLoading={viewedLoading}
            markViewed={markViewed}
          />
        ) : (
          <PropertyListView
            properties={properties}
            loading={loading}
            viewedIds={viewedIds}
            viewedLoading={viewedLoading}
            markViewed={markViewed}
          />
        )}
      </div>
    </PageShell>
  )
}