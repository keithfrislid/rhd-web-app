"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type BuyerRow = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  created_at: string
  buy_box: {
    counties: string[]
    updated_at: string | null
  }
}

function shortId(id: string) {
  if (!id) return ""
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

export default function AdminBuyBoxesPanel() {
  const [loading, setLoading] = useState(true)
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const buyersWithAny = useMemo(() => buyers.filter((b) => (b.buy_box?.counties?.length ?? 0) > 0), [buyers])

  const call = async () => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error("No session")

    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-buy-boxes`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
    return json
  }

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const json = await call()
      setBuyers((json.buyers ?? []) as BuyerRow[])
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load buy boxes")
      setBuyers([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Buyer Buy Boxes</div>
          <div className="mt-0.5 text-xs text-white/60">
            {loading ? "Loading…" : `${buyersWithAny.length} / ${buyers.length} buyers configured`}
          </div>
        </div>

        <button onClick={load} className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="m-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="p-4 text-sm text-white/70">Loading buyers…</div>
      ) : buyers.length === 0 ? (
        <div className="p-4 text-sm text-white/70">No buyers yet.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-black/30 text-xs font-semibold text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Buyer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Counties</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">User ID</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {buyers.map((b) => {
                const name = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || "—"
                const counties = Array.isArray(b.buy_box?.counties) ? b.buy_box.counties : []

                return (
                  <tr key={b.user_id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">{name}</td>
                    <td className="px-4 py-3 text-white/80">{b.email ?? "—"}</td>
                    <td className="px-4 py-3 text-white/80">
                      {counties.length === 0 ? (
                        <span className="text-white/50">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {counties.slice(0, 8).map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center rounded-full border border-white/15 bg-black/30 px-2 py-1 text-xs font-semibold"
                            >
                              {c}
                            </span>
                          ))}
                          {counties.length > 8 && (
                            <span className="text-xs text-white/50">+{counties.length - 8} more</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      {b.buy_box?.updated_at ? new Date(b.buy_box.updated_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-xs font-semibold">
                        {shortId(b.user_id)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 text-xs text-white/50 border-t border-white/10">
        This is read-only for now. Buyers edit their own buy box from the “Buy Box” tab.
      </div>
    </div>
  )
}