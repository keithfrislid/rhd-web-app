"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import PropertyListView from "@/components/PropertyListView"

const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-white/10 p-4 text-sm text-white/70">
      Loading map…
    </div>
  ),
})

type ViewMode = "map" | "list"

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("map")

  return (
    <main className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Browse Deals</h1>
          <p className="mt-1 text-sm text-white/70">
            Map-first browsing with compact investor list view.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("map")}
            className={`rounded-xl px-3 py-2 text-sm border border-white/20 ${
              viewMode === "map" ? "bg-white text-black" : "hover:bg-white/10"
            }`}
          >
            Map
          </button>

          <button
            onClick={() => setViewMode("list")}
            className={`rounded-xl px-3 py-2 text-sm border border-white/20 ${
              viewMode === "list" ? "bg-white text-black" : "hover:bg-white/10"
            }`}
          >
            List
          </button>
        </div>
      </div>

      <div className="mt-6">
        {viewMode === "map" ? <LeafletMap /> : <PropertyListView />}
      </div>
    </main>
  )
}
