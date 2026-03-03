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
    <div className="mt-6 rounded-2xl border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] flex items-center justify-between">
        <div className="text-sm font-semibold text-[var(--text)]">Pending Offer Inbox</div>
        <div className="text-xs text-[var(--muted)]">
          {inboxLoading ? "Loading…" : `${pendingOffers.length} total`}
        </div>
      </div>

      {inboxLoading ? (
        <div className="p-4 text-sm text-[var(--muted)]">Loading pending offers…</div>
      ) : pendingOffers.length === 0 ? (
        <div className="p-4 text-sm text-[var(--muted)]">No pending offers right now.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-[var(--surface-2)] text-xs font-semibold text-[var(--muted)]">
              <tr className="border-b border-[var(--border)]">
                <th className="px-4 py-3">Property</th>
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Ask</th>
                <th className="px-4 py-3">Offer</th>
                <th className="px-4 py-3">Delta</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border)]">
              {pendingOffers.map((o) => {
                const p = o.properties
                const ask = p?.price ?? 0
                const d = p ? delta(o.offer_price, ask) : 0

                const deltaTone =
                  d >= 0
                    ? "text-[var(--success)] bg-[var(--success-dim)] border-[var(--success)]/30"
                    : "text-[var(--danger)] bg-[var(--danger-dim)] border-[var(--danger)]/30"

                return (
                  <tr
                    key={o.id}
                    className="cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                    title="Open property in Admin"
                    onClick={() => onOpenProperty(o.property_id)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--text)]">
                        {p?.address ?? "Unknown property"}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]">
                        Property ID: {o.property_id.slice(0, 6)}…{o.property_id.slice(-4)}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="font-semibold text-[var(--text)]">
                        {(() => {
                          const name = `${o.buyer?.first_name ?? ""} ${o.buyer?.last_name ?? ""}`.trim()
                          return name || o.buyer?.email || "—"
                        })()}
                      </div>
                      <div className="mt-0.5 text-xs text-[var(--muted)]">
                        {o.buyer?.email ? o.buyer.email : `User: ${o.user_id.slice(0, 6)}…${o.user_id.slice(-4)}`}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-[var(--text)]">{formatMoney(ask)}</td>

                    <td className="px-4 py-3 font-semibold text-[var(--text)]">{formatMoney(o.offer_price)}</td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${deltaTone}`}
                      >
                        {formatDelta(d)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(o.created_at).toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-[var(--muted)]">
                      <span className="line-clamp-2">{o.notes ?? "—"}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 text-xs text-[var(--muted)] border-t border-[var(--border)]">
        Tip: Click a row to jump into the property's offers panel and accept the winning offer.
      </div>
    </div>
  )
}
