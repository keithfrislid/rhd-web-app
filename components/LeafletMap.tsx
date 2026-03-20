"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

import { supabase } from "@/lib/supabase"
import DealSheetPanel from "@/components/DealSheetPanel"
import { effectiveVisibility, type Property } from "@/lib/properties"

export default function LeafletMap({
  properties,
  loading,
  viewedIds,
  viewedLoading,
  markViewed,
  unmarkViewed,
  onSwitchToList,
}: {
  properties: Property[]
  loading: boolean
  viewedIds: Set<string>
  viewedLoading: boolean
  markViewed: (propertyId: string) => void | Promise<void>
  unmarkViewed: (propertyId: string) => void | Promise<void>
  onSwitchToList?: () => void
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)
  const [selected, setSelected] = useState<Property | null>(null)
  const [skipMarkViewedId, setSkipMarkViewedId] = useState<string | null>(null)

  const [pendingOfferIds, setPendingOfferIds] = useState<Set<string>>(new Set())

  // Derive which legend items are actually present on the map for this user
  const activeLegendItems = useMemo(() => {
    if (loading || viewedLoading) return new Set<string>()
    const items = new Set<string>()
    for (const p of properties) {
      if (pendingOfferIds.has(p.id)) { items.add("pending"); continue }
      const vis = effectiveVisibility(p)
      if (vis === "exclusive") { items.add("firstdibs"); continue }
      if (vis === "vip")       { items.add("vip");       continue }
      if (viewedIds.has(p.id)) { items.add("viewed");    continue }
      items.add("new")
    }
    return items
  }, [properties, viewedIds, viewedLoading, loading, pendingOfferIds])

  // Load pending offer IDs for the current user
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("offers")
        .select("property_id")
        .eq("user_id", user.id)
        .eq("status", "pending")

      setPendingOfferIds(new Set((data ?? []).map((r: any) => r.property_id as string)))
    }

    load()

    const handler = () => load()
    window.addEventListener("rhd:offers-changed", handler)
    return () => window.removeEventListener("rhd:offers-changed", handler)
  }, [])

  // 2) Create the map ONCE
  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    ;(async () => {
      const L = await import("leaflet")
      if (cancelled) return

      if (!mapInstanceRef.current) {
        // popup styling injection once
        const styleId = "rhd-leaflet-styles"
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style")
          style.id = styleId
          style.innerHTML = `
            /* Leaflet chrome */
            .leaflet-popup-content-wrapper {
              border-radius: 16px;
              box-shadow: 0 18px 40px rgba(0,0,0,0.20);
              border: 1px solid var(--border, rgba(48,54,61,0.85));
              background: var(--surface, #161b22);
              color: var(--text, rgba(255,255,255,0.92));
              overflow: hidden;
            }
            .leaflet-popup-content { margin: 0; }

            .leaflet-popup-tip {
              box-shadow: 0 14px 30px rgba(0,0,0,0.12);
              background: var(--surface, #161b22);
              border: 1px solid var(--border, rgba(48,54,61,0.85));
            }

            /* Popup layout (minimal) */
            .rhd-popup {
              font-family: ui-sans-serif, system-ui;
              min-width: 260px;
              max-width: 320px;
            }

            .rhd-popup-body {
              padding: 12px 14px;
              display: grid;
              gap: 10px;
            }

            .rhd-address {
              font-weight: 800;
              font-size: 14px;
              line-height: 1.25;
              color: var(--text, rgba(255,255,255,0.92));

              /* Allow 2 lines, then ellipsis */
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              overflow: hidden;
            }

            .rhd-actions {
              display: flex;
              justify-content: flex-end;
            }

            /* Smaller, “link-like” button that fits the card */
            .rhd-popup-btn {
              display: inline-flex;
              align-items: center;
              gap: 8px;

              width: auto;              /* key change vs full width */
              margin-top: 0;            /* remove the big spacing */
              padding: 8px 10px;
              border-radius: 12px;

              border: 1px solid var(--border, rgba(48,54,61,0.85));
              background: var(--surface-2, #21262d);
              color: var(--text, rgba(255,255,255,0.92));

              font-size: 12px;
              font-weight: 800;
              cursor: pointer;
              user-select: none;
            }

            .rhd-popup-btn:hover {
              filter: brightness(1.08);
            }

            .rhd-popup-btn:active {
              transform: translateY(0.5px);
            }

            /* Badges */
            .rhd-badges { display:flex; gap:6px; flex-wrap:wrap; margin-top: 8px; }
            .rhd-badge {
              display:inline-flex;
              align-items:center;
              justify-content:center;
              font-size:11px;
              padding:4px 8px;
              border-radius:9999px;
              font-weight:800;
              white-space:nowrap;
              border: 1px solid rgba(255,255,255,0.10);
              background: rgba(255,255,255,0.06);
              color: rgba(255,255,255,0.85);
            }
            .rhd-badge-new {
              background: #dc2626;
              border-color: rgba(220,38,38,0.45);
              color: #000;
            }
            .rhd-badge-uc {
              background: rgba(245,158,11,0.18);
              border-color: rgba(245,158,11,0.30);
              color: #fde68a;
            }
            .rhd-badge-viewed {
              background: rgba(255,255,255,0.05);
              border-color: rgba(255,255,255,0.10);
              color: rgba(255,255,255,0.65);
            }

            /* Price/Repairs/ARV chips (match list feel) */
            .rhd-chips {
              display:grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 8px;
              margin-top: 10px;
            }
            .rhd-chip {
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.10);
              background: rgba(255,255,255,0.04);
              padding: 8px 8px;
            }
            .rhd-chip-label {
              font-size: 10px;
              color: rgba(255,255,255,0.62);
              margin-bottom: 2px;
            }
            .rhd-chip-val {
              font-size: 12px;
              font-weight: 800;
              color: rgba(255,255,255,0.92);
            }

            /* CTA */
            .rhd-popup-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              margin-top: 12px;
              padding: 10px 12px;
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.12);
              background: rgba(255,255,255,0.92);
              color: #000;
              font-weight: 800;
              cursor: pointer;
              user-select: none;
            }
            .rhd-popup-btn:hover { background: rgba(255,255,255,0.85); }

            .rhd-hint {
              margin-top: 8px;
              font-size: 10px;
              color: rgba(255,255,255,0.58);
            }

          `
          document.head.appendChild(style)
        }

        // In case hot reload / remount keeps old leaflet id
        ;(containerRef.current as any)._leaflet_id = null

        const map = L.map(containerRef.current!, { zoomControl: false })
        mapInstanceRef.current = map

        L.control.zoom({ position: "topright" }).addTo(map)

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        }).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // 3) Render markers whenever properties changes
  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    ;(async () => {
      const L = await import("leaflet")
      if (cancelled) return

      const map = mapInstanceRef.current
      const layer = markersLayerRef.current
      if (!map || !layer) return

      // ✅ Prevent red→black flicker on first mount:
      // wait until viewedIds has been hydrated for this property set
      if (loading) return
      if (viewedLoading) return

      layer.clearLayers()

      if (!properties || properties.length === 0) return

      const pinColorFor = (property: Property) => {
        if (pendingOfferIds.has(property.id)) return "#3b82f6"       // blue   — pending offer

        const vis = effectiveVisibility(property)
        if (vis === "exclusive") return "#5d00d7"                    // purple — first dibs
        if (vis === "vip")       return "#eab308"                     // gold   — VIP access

        // Public stage: apply standard states
        if (!viewedLoading && viewedIds.has(property.id)) return "#374151" // dark — viewed
        if (property.status === "Under Contract")  return "#f59e0b"  // amber  — under contract
        return "#ef4444"                                              // red    — new
      }

      properties.forEach((property) => {
        const pinColor = pinColorFor(property)

        const pinSvg = `
          <svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="${pinColor}" />
            <circle cx="12" cy="10" r="2.7" fill="white" opacity="0.95"/>
          </svg>
        `

        const icon = L.divIcon({
          className: "",
          html: pinSvg,
          iconSize: [34, 34],
          iconAnchor: [17, 32],
          popupAnchor: [0, -28],
        })

        const marker = L.marker([property.lat, property.lng], { icon }).addTo(layer)

        const wrapper = L.DomUtil.create("div")
        wrapper.className = "rhd-popup"

        // Popup content (polish): minimal — address + View Details only
        wrapper.innerHTML = `
          <div class="rhd-popup-body">
            <div class="rhd-address" title="${property.address}">${property.address}</div>

            <div class="rhd-actions">
              <button type="button" class="rhd-popup-btn">
                View details <span aria-hidden="true">→</span>
              </button>
            </div>
          </div>
        `

        L.DomEvent.disableClickPropagation(wrapper)

        const btn = wrapper.querySelector(".rhd-popup-btn") as HTMLButtonElement | null
        if (btn) {
          L.DomEvent.on(btn, "click", (e: any) => {
            L.DomEvent.stop(e)
            setSelected(property)
            map.closePopup()
          })
        }

        marker.bindPopup(wrapper)
      })

      // Fit bounds
      const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng] as any))
      map.fitBounds(bounds, { padding: [40, 40] })
      if (map.getZoom() > 13) map.setZoom(13)
    })()

    return () => {
      cancelled = true
    }
  }, [properties, viewedIds, viewedLoading, loading, pendingOfferIds])

  // 4) Remove map only on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full isolate">
      <div
        ref={containerRef}
        className="w-full h-[calc(100svh-175px)] md:h-[72vh] md:min-h-[520px] min-h-[300px] rounded-xl overflow-hidden relative z-0"
      />

      {/* Map / List toggle — left side, below zoom controls */}
      {onSwitchToList && (
        <div className="absolute top-3 left-3 z-[1500] pointer-events-auto">
          <div className="flex items-center rounded-full border border-[var(--border)] bg-black/70 backdrop-blur overflow-hidden">
            <span className="px-3 py-1.5 text-xs font-semibold text-white select-none">Map</span>
            <div className="w-px h-4 bg-white/20" />
            <button
              onClick={onSwitchToList}
              className="px-3 py-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors"
            >
              List
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-x-0 top-3 z-[1500] flex justify-center pointer-events-none">
          <div className="rounded-full border border-[var(--border)] bg-black/60 px-3 py-1 text-xs text-[var(--muted)] backdrop-blur">
            Loading properties…
          </div>
        </div>
      )}

      {/* Pin legend — bottom-right, hidden on mobile, only shows active pin types */}
      {!loading && activeLegendItems.size > 0 && (() => {
        const all = [
          { key: "firstdibs", color: "#7e22ce", label: "First Dibs" },
          { key: "vip",       color: "#eab308", label: "VIP" },
          { key: "new",       color: "#ef4444", label: "New" },
          { key: "pending",   color: "#3b82f6", label: "Pending" },
          { key: "viewed",    color: "#374151", label: "Viewed" },
        ].filter((item) => activeLegendItems.has(item.key))

        return (
          <div className="hidden sm:block absolute bottom-6 right-3 z-[1500] pointer-events-none">
            <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-black/70 backdrop-blur px-3 py-1.5">
              {all.map((item, i) => (
                <span key={item.key} className="flex items-center gap-2.5">
                  {i > 0 && <span className="h-3 w-px bg-white/15" />}
                  <span className="flex items-center gap-1.5 text-[10px] text-white/70">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )
      })()}

      {selected && (
        <>
          {/* Mobile backdrop */}
          <div
            className="absolute inset-0 z-[1999] bg-black/40 md:hidden"
            onClick={() => { markViewed(selected.id); setSkipMarkViewedId(null); setSelected(null) }}
          />
          {/* Panel */}
          <div className="absolute inset-x-0 bottom-0 z-[2000] pointer-events-auto md:right-4 md:left-auto md:top-4 md:bottom-auto md:w-[400px]">
            <div className="mx-3 mb-3 md:mx-0 md:mb-0">
              <DealSheetPanel
                selected={selected}
                onClose={() => {
                  if (skipMarkViewedId !== selected.id) {
                    markViewed(selected.id)
                  }
                  setSkipMarkViewedId(null)
                  setSelected(null)
                }}
                isViewed={viewedIds.has(selected.id)}
                onMarkNew={() => {
                  unmarkViewed(selected.id)
                  setSkipMarkViewedId(selected.id)
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}