"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

import DealSheetPanel from "@/components/DealSheetPanel"
import { fetchProperties, type Property, formatMoney } from "@/lib/properties"

export default function LeafletMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersLayerRef = useRef<any>(null)

  const [selected, setSelected] = useState<Property | null>(null)
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const rows = await fetchProperties()
      setProperties(rows)
      setLoading(false)
    }
    run()
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    ;(async () => {
      const L = await import("leaflet")
      if (cancelled) return

      // create map once
      if (!mapInstanceRef.current) {
        const styleId = "rhd-leaflet-styles"
        if (!document.getElementById(styleId)) {
          const style = document.createElement("style")
          style.id = styleId
          style.innerHTML = `
            .leaflet-popup-content-wrapper { border-radius: 14px; box-shadow: 0 18px 40px rgba(0,0,0,0.20); }
            .leaflet-popup-content { margin: 12px 14px; }
            .leaflet-popup-tip { box-shadow: 0 14px 30px rgba(0,0,0,0.12); }

            .rhd-popup-btn {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              margin-top: 10px;
              padding: 10px 12px;
              border-radius: 12px;
              border: 1px solid rgba(0,0,0,0.10);
              background: #111827;
              color: white;
              font-weight: 650;
              cursor: pointer;
              user-select: none;
            }
            .rhd-popup-btn:hover { background: #0b1220; }
          `
          document.head.appendChild(style)
        }

        ;(containerRef.current as any)._leaflet_id = null

        const map = L.map(containerRef.current!)
        mapInstanceRef.current = map

        L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
          attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
        }).addTo(map)

        markersLayerRef.current = L.layerGroup().addTo(map)
      }

      // render markers whenever properties change
      const map = mapInstanceRef.current
      const layer = markersLayerRef.current
      if (!map || !layer) return

      layer.clearLayers()

      if (properties.length === 0) return

      const pinColor = "#ef4444"
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

      properties.forEach((property) => {
        const marker = L.marker([property.lat, property.lng], { icon }).addTo(layer)

        const wrapper = L.DomUtil.create("div")
        wrapper.style.fontFamily = "ui-sans-serif, system-ui"
        wrapper.style.minWidth = "240px"

        wrapper.innerHTML = `
          <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:6px;">
            <div style="font-weight:650; line-height:1.2;">${property.address}</div>
            <div style="
              display:${property.status === "New" ? "inline-flex" : "none"};
              font-size:11px;
              padding:4px 8px;
              border-radius:9999px;
              background:#dc2626;
              color:#ffffff;
              font-weight:700;
              white-space:nowrap;
              align-items:center;
              justify-content:center;
            ">
              New
            </div>
          </div>
          <div style="font-weight:800; font-size:16px;">${formatMoney(property.price)}</div>
          <div style="opacity:0.85; margin-top:4px;">
            ${property.beds} Beds • ${property.baths} Baths
          </div>
          <button type="button" class="rhd-popup-btn">View Details</button>
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

      const bounds = L.latLngBounds(properties.map((p) => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
      if (map.getZoom() > 13) map.setZoom(13)
    })()

    return () => {
      cancelled = true
    }
  }, [properties])

  // remove map on unmount
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
          <div className="rounded-full border border-white/10 bg-black/60 px-3 py-1 text-xs text-white/70 backdrop-blur">
            Loading properties…
          </div>
        </div>
      )}

      {selected && (
        <div className="absolute left-0 right-0 bottom-0 md:right-4 md:left-auto md:top-4 md:bottom-auto md:w-[400px] z-[2000] pointer-events-auto">
          <div className="mx-3 md:mx-0">
            <DealSheetPanel selected={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
