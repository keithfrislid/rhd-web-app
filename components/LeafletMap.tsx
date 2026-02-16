"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

type Property = {
  id: string
  address: string
  price: number
  beds: number
  baths: number
  lat: number
  lng: number
}

const mockProperties: Property[] = [
  {
    id: "1",
    address: "123 Main St, Nashville, TN",
    price: 245000,
    beds: 3,
    baths: 2,
    lat: 36.1627,
    lng: -86.7816,
  },
  {
    id: "2",
    address: "456 Oak Ave, Madison, TN",
    price: 189000,
    beds: 2,
    baths: 1,
    lat: 36.2565,
    lng: -86.715,
  },
  {
    id: "3",
    address: "789 Cedar Ln, Antioch, TN",
    price: 310000,
    beds: 4,
    baths: 2,
    lat: 36.0601,
    lng: -86.6711,
  },
]

export default function LeafletMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapInstanceRef = useRef<any>(null)

  const [selected, setSelected] = useState<Property | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    if (mapInstanceRef.current) return

    let cancelled = false

    ;(async () => {
      const L = await import("leaflet")
      if (cancelled) return

      // Inject styling once
      const styleId = "rhd-leaflet-styles"
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style")
        style.id = styleId
        style.innerHTML = `
          .leaflet-popup-content-wrapper {
            border-radius: 14px;
            box-shadow: 0 18px 40px rgba(0,0,0,0.25);
          }
          .leaflet-popup-content { margin: 12px 14px; }
          .leaflet-popup-tip { box-shadow: 0 14px 30px rgba(0,0,0,0.18); }

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

      // Extra safety for Next dev reloads
      ;(containerRef.current as any)._leaflet_id = null

      const map = L.map(containerRef.current!)
      mapInstanceRef.current = map

      // Basemap you liked
      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      }).addTo(map)

      // Red pin-drop marker (SVG)
      const pinColor = "#ef4444"
      const pinSvg = `
        <svg width="34" height="34" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" fill="${pinColor}" />
          <circle cx="12" cy="10" r="2.7" fill="white" opacity="0.95"/>
        </svg>
      `
      const offMarketIcon = L.divIcon({
        className: "",
        html: pinSvg,
        iconSize: [34, 34],
        iconAnchor: [17, 32],
        popupAnchor: [0, -28],
      })

      // Add markers + popups (DOM-based popup so button click is reliable)
      mockProperties.forEach((property) => {
        const marker = L.marker([property.lat, property.lng], { icon: offMarketIcon }).addTo(map)

        // Build popup content as a real DOM node
        const wrapper = L.DomUtil.create("div")
        wrapper.style.fontFamily = "ui-sans-serif, system-ui"
        wrapper.style.minWidth = "240px"

        wrapper.innerHTML = `
          <div style="font-weight:650; margin-bottom:6px;">${property.address}</div>
          <div style="font-weight:800; font-size:16px;">$${property.price.toLocaleString()}</div>
          <div style="opacity:0.85; margin-top:4px;">
            ${property.beds} Beds • ${property.baths} Baths
          </div>
          <button type="button" class="rhd-popup-btn">View Details</button>
        `

        // IMPORTANT: stop clicks inside the popup from being swallowed by the map
        L.DomEvent.disableClickPropagation(wrapper)

        const btn = wrapper.querySelector(".rhd-popup-btn") as HTMLButtonElement | null
        if (btn) {
          L.DomEvent.on(btn, "click", (e: any) => {
            L.DomEvent.stop(e) // prevents Leaflet from hijacking it
            setSelected(property)
            map.closePopup()
          })
        }

        marker.bindPopup(wrapper)
      })

      // Auto-fit
      const bounds = L.latLngBounds(mockProperties.map((p) => [p.lat, p.lng]))
      map.fitBounds(bounds, { padding: [40, 40] })
      if (map.getZoom() > 13) map.setZoom(13)
    })()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full isolate">
      <div ref={containerRef} className="w-full h-[500px] rounded-xl overflow-hidden relative z-0" />

      {/* Detail Panel */}
      {selected && (
        <div className="absolute left-0 right-0 bottom-0 md:right-4 md:left-auto md:top-4 md:bottom-auto md:w-[360px] z-[2000] pointer-events-auto">
          <div className="mx-3 md:mx-0 rounded-2xl bg-zinc-950/95 text-white border border-white/10 shadow-2xl backdrop-blur p-4 z-[2000]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm text-white/70">Selected Property</div>
                <div className="mt-1 text-base font-semibold">{selected.address}</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Price</div>
                <div className="mt-1 font-semibold">${selected.price.toLocaleString()}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Beds</div>
                <div className="mt-1 font-semibold">{selected.beds}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Baths</div>
                <div className="mt-1 font-semibold">{selected.baths}</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button className="flex-1 rounded-xl bg-white text-black font-semibold py-2 hover:opacity-90">
                Request Access
              </button>
              <button className="flex-1 rounded-xl border border-white/15 py-2 font-semibold hover:bg-white/5">
                Save
              </button>
            </div>

            <div className="mt-3 text-xs text-white/60">
              Next: images + investor metrics (ARV, repairs, spread) + a “Submit Offer” CTA.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
