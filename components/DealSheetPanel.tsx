"use client"

import type { Property } from "@/lib/properties"
import { formatMoney } from "@/lib/properties"

export default function DealSheetPanel({
  selected,
  onClose,
}: {
  selected: Property
  onClose: () => void
}) {
  const spread = selected.arv - selected.price - selected.repairs

  return (
    <div className="rounded-2xl bg-zinc-950/95 text-white border border-white/10 shadow-2xl backdrop-blur p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs tracking-wide uppercase text-white/60">
            Deal Sheet
          </div>

          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="text-base font-semibold leading-snug break-words">
              {selected.address}
            </div>

            {selected.status === "New" && (
              <div className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-red-600/90 border border-red-400/40 text-white font-semibold shadow-sm">
                New
              </div>
            )}
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
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
          <div className="mt-1 font-semibold">
            {formatMoney(selected.repairs)}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Spread</div>
          <div className="mt-1 font-semibold">{formatMoney(spread)}</div>
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
        (Mock data) Next we can add: comps placeholder + notes + “Due Diligence”
        checklist.
      </div>
    </div>
  )
}
