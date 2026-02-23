"use client"

import type { PendingOfferRow } from "@/lib/hooks/useAdminData"
import { formatMoney } from "@/lib/properties"

function delta(offer: number, ask: number) {
  return offer - ask
}

function formatDelta(n: number) {
  const sign = n > 0 ? "+" : ""
  return `${sign}${formatMoney(n)}`
}

type Props = {
  inboxLoading: boolean
  pendingOffers: PendingOfferRow[]
  onOpenProperty: (propertyId: string) => void
}

export default function AdminInboxPanel({ inboxLoading, pendingOffers, onOpenProperty }: Props) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div className="text-sm font-semibold">Pending Offer Inbox</div>
        <div className="text-xs text-white/60">
          {inboxLoading ? "Loading…" : `${pendingOffers.length} total`}
        </div>
      </div>

      {inboxLoading ? (
        <div className="p-4 text-sm text-white/70">Loading pending offers…</div>
      ) : pendingOffers.length === 0 ? (
        <div className="p-4 text-sm text-white/70">No pending offers right now.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-black/30 text-xs font-semibold text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Ask</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Delta</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {pendingOffers.map((o) => {
                const p = o.properties
                const ask = p?.price ?? 0
                const d = p ? delta(o.offer_price, ask) : 0

                const deltaTone =
                  d >= 0
                    ? "text-emerald-200 bg-emerald-500/10 border-emerald-400/25"
                    : "text-red-200 bg-red-500/10 border-red-400/25"

                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-white/5"
                    title="Open property in Admin"
                    onClick={() => onOpenProperty(o.property_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white">
                        {p?.address ?? "Unknown property"}
                      </div>
                      <div className="mt-0.5 text-xs text-white/50">
                        Property ID: {o.property_id.slice(0, 6)}…{o.property_id.slice(-4)}
                      </div>
                    </td>

                    <td className="px-4 py-3">{formatMoney(ask)}</td>

                    <td className="px-4 py-3 font-semibold">{formatMoney(o.offer_price)}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${deltaTone}`}
                      >
                        {formatDelta(d)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-white/70">
                      {new Date(o.created_at).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-white/70">
                      <span className="line-clamp-2">{o.notes ?? "—"}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 text-xs text-white/50 border-t border-white/10">
        Tip: Click a row to jump into the property’s offers panel and accept the winning offer.
      </div>
    </div>
  )
}