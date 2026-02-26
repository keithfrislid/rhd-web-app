"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

import DealSheetPanel from "@/components/DealSheetPanel"
import { type Property, formatMoney } from "@/lib/properties"

export default function LeafletMap({
  properties,
  loading,
  viewedIds,
  viewedLoading,
  markViewed,
}: {
  properties: Property[]
  loading: boolean
  viewedIds: Set<string>
  viewedLoading: boolean
  markViewed: (propertyId: string) => void | Promise<void>
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  const [selected, setSelected] = useState<Property | null>(null)

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

        const map = L.map(containerRef.current!)
        mapInstanceRef.current = map

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
        // If viewed, make it dark (regardless of status)
        if (!viewedLoading && viewedIds.has(property.id)) return "#111827"

        // Otherwise normal lifecycle colors
        if (property.status === "Under Contract") return "#f59e0b"
        return "#ef4444"
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
  }, [properties, viewedIds, viewedLoading, loading])

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
        className="w-full h-[70vh] min-h-[520px] rounded-xl overflow-hidden relative z-0"
      />

      {loading && (
        <div className="absolute inset-x-0 top-3 z-[1500] flex justify-center pointer-events-none">
          <div className="rounded-full border border-[var(--border)] bg-black/60 px-3 py-1 text-xs text-[var(--muted)] backdrop-blur">
            Loading properties…
          </div>
        </div>
      )}

      {selected && (
        <div className="absolute left-0 right-0 bottom-0 md:right-4 md:left-auto md:top-4 md:bottom-auto md:w-[400px] z-[2000] pointer-events-auto">
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