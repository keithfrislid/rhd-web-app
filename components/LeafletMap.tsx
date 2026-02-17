"use client"

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"

type Property = {
  id: string
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  acres: number
  arv: number
  repairs: number
  lat: number
  lng: number
  photoUrl: string
  status: "New" | "Price Drop" | "Under Contract"
}

const mockProperties: Property[] = [
  {
    id: "1",
    address: "123 Main St, Nashville, TN",
    price: 245000,
    beds: 3,
    baths: 2,
    sqft: 1480,
    acres: 0.19,
    arv: 335000,
    repairs: 45000,
    lat: 36.1627,
    lng: -86.7816,
    photoUrl: "https://photos.google.com/", // replace with your real link
    status: "New",
  },
  {
    id: "2",
    address: "456 Oak Ave, Madison, TN",
    price: 189000,
    beds: 2,
    baths: 1,
    sqft: 1060,
    acres: 0.22,
    arv: 275000,
    repairs: 35000,
    lat: 36.2565,
    lng: -86.715,
    photoUrl: "https://photos.google.com/",
    status: "New",
  },
  {
    id: "3",
    address: "789 Cedar Ln, Antioch, TN",
    price: 310000,
    beds: 4,
    baths: 2,
    sqft: 1925,
    acres: 0.31,
    arv: 405000,
    repairs: 55000,
    lat: 36.0601,
    lng: -86.6711,
    photoUrl: "https://photos.google.com/",
    status: "New",
  },
]

function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

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
            box-shadow: 0 18px 40px rgba(0,0,0,0.20);
          }
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

      // Map style you liked
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

      mockProperties.forEach((property) => {
        const marker = L.marker([property.lat, property.lng], { icon: offMarketIcon }).addTo(map)

        // DOM-based popup (reliable click)
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

  const spread =
    selected ? selected.arv - selected.price - selected.repairs : null

  return (
    <div className="relative w-full isolate">
      {/* Map */}
      <div
        ref={containerRef}
        className="w-full h-[500px] rounded-xl overflow-hidden relative z-0"
      />

      {/* Deal Sheet Panel (clean / institutional) */}
      {selected && (
        <div className="absolute left-0 right-0 bottom-0 md:right-4 md:left-auto md:top-4 md:bottom-auto md:w-[420px] z-[2000] pointer-events-auto">
          <div className="mx-3 md:mx-0 rounded-2xl bg-zinc-950/95 text-white border border-white/10 shadow-2xl backdrop-blur p-5 z-[2000]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs tracking-wide uppercase text-white/60">
                  Deal Sheet
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="text-base font-semibold leading-snug">{selected.address}</div>
                  {selected.status === "New" && (
                    <div className="text-[11px] px-2 py-1 rounded-full bg-red-600/90 border border-red-400/40 text-white font-semibold shadow-sm">
                      New
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
              >
                Close
              </button>
            </div>

            {/* Quick stats */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Price</div>
                <div className="mt-1 text-lg font-semibold">
                  {formatMoney(selected.price)}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Property</div>
                <div className="mt-1 font-semibold">
                  {selected.beds} bd • {selected.baths} ba
                </div>
                <div className="text-sm text-white/70">
                  {selected.sqft.toLocaleString()} sqft • {selected.acres} acres
                </div>
              </div>
            </div>

            {/* Investor metrics */}
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">ARV</div>
                <div className="mt-1 font-semibold">{formatMoney(selected.arv)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Repairs</div>
                <div className="mt-1 font-semibold">{formatMoney(selected.repairs)}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-white/60">Spread</div>
                <div className="mt-1 font-semibold">
                  {spread !== null ? formatMoney(spread) : "--"}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-4 grid grid-cols-3 gap-2">
              <a
                href={selected.photoUrl}
                target="_blank"
                rel="noreferrer"
                className="col-span-1 rounded-xl border border-white/15 py-2 text-center font-semibold hover:bg-white/5"
              >
                Photos
              </a>
              <button className="col-span-2 rounded-xl bg-white text-black font-semibold py-2 hover:opacity-90">
                Submit Offer
              </button>
            </div>

            <div className="mt-2">
              <button className="w-full rounded-xl border border-white/15 py-2 font-semibold hover:bg-white/5">
                Save
              </button>
            </div>

            <div className="mt-3 text-xs text-white/60">
              (Mock data) Next we can add: comps placeholder + notes + “Due
              Diligence” checklist.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
