"use client"

import { useEffect, useRef } from "react"
import "leaflet/dist/leaflet.css"

// Decorative teaser pins — real TN cities, no actual property data
const TEASER_PINS = [
  { lat: 36.174, lng: -86.767, color: "#3b82f6", label: "Nashville" },
  { lat: 35.961, lng: -83.921, color: "#ef4444", label: "Knoxville" },
  { lat: 35.150, lng: -90.049, color: "#374151", label: "Memphis" },
  { lat: 35.046, lng: -85.310, color: "#ef4444", label: "Chattanooga" },
  { lat: 36.530, lng: -87.360, color: "#374151", label: "Clarksville" },
  { lat: 36.340, lng: -82.210, color: "#3b82f6", label: "Johnson City" },
  { lat: 35.614, lng: -88.815, color: "#ef4444", label: "Jackson" },
  { lat: 36.160, lng: -85.502, color: "#ef4444", label: "Cookeville" },
  { lat: 35.929, lng: -84.012, color: "#374151", label: "Maryville" },
  { lat: 36.523, lng: -86.885, color: "#374151", label: "Springfield" },
  { lat: 35.732, lng: -86.893, color: "#eab308", label: "Franklin" },
  { lat: 35.846, lng: -86.390, color: "#374151", label: "Murfreesboro" },
]

function makePinSvg(color: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24C24 5.373 18.627 0 12 0z"
        fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.5" fill="white" opacity="0.9"/>
    </svg>
  `)}`
}

export default function LoginMap() {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    ;(async () => {
      const L = await import("leaflet")
      if (cancelled || !containerRef.current) return

      ;(containerRef.current as any)._leaflet_id = null

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: true,
        scrollWheelZoom: false,
        dragging: true,
        touchZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      })

      mapRef.current = map

      map.setView([35.9, -86.4], 7)

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      }).addTo(map)

      for (const pin of TEASER_PINS) {
        const icon = L.icon({
          iconUrl: makePinSvg(pin.color),
          iconSize: [24, 36],
          iconAnchor: [12, 36],
        })
        L.marker([pin.lat, pin.lng], { icon, interactive: false }).addTo(map)
      }
    })()

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full" />
  )
}
