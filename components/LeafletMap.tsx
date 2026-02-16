"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMapType } from "leaflet";

const NASHVILLE: [number, number] = [36.1627, -86.7816];

export default function LeafletMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMapType | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!containerRef.current) return;
      if (mapRef.current) return;

      const Lmod = await import("leaflet");
      const L = (Lmod as any).default ?? (Lmod as any);

      if (cancelled) return;

      (L.Icon.Default as any).mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, { zoomControl: true }).setView(
        NASHVILLE,
        10
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      L.marker(NASHVILLE).addTo(map).bindPopup("Nashville (default center)");

      mapRef.current = map;
    }

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-white/10">
      <div ref={containerRef} className="h-[70vh] w-full" />
    </div>
  );
}
