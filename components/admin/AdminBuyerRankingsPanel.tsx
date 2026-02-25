"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type BuyerTier = "regular" | "vip"

type BuyerRow = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  phone?: string | null
  created_at: string
  buyer_tier: BuyerTier | null
  vip_rank: number | null
}

function shortId(id: string) {
  if (!id) return ""
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function safeRank(v: unknown) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  // Keep it simple: 0..999
  return Math.max(0, Math.min(999, Math.trunc(n)))
}

export default function AdminBuyerRankingsPanel() {
  const [loading, setLoading] = useState(true)
  const [buyers, setBuyers] = useState<BuyerRow[]>([])
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Saving state per user
  const [savingByUser, setSavingByUser] = useState<Record<string, boolean>>({})

  const vipCount = useMemo(
    () => buyers.filter((b) => (b.buyer_tier ?? "regular") === "vip").length,
    [buyers]
  )

  const call = async (path: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error("No session")

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users${path}`,
      {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(init?.headers ?? {}),
        },
      }
    )

    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)
    return json
  }

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const json = await call("/buyers", { method: "GET" })
      setBuyers((json.buyers ?? []) as BuyerRow[])
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load buyers")
      setBuyers([])
    } finally {
      setLoading(false)
    }
  }

  const saveBuyer = async (
    userId: string,
    patch: { buyer_tier?: BuyerTier; vip_rank?: number }
  ) => {
    setSavingByUser((m) => ({ ...m, [userId]: true }))
    setErrorMsg(null)

    // optimistic update
    setBuyers((prev) =>
      prev.map((b) =>
        b.user_id === userId
          ? {
              ...b,
              buyer_tier: patch.buyer_tier ?? b.buyer_tier,
              vip_rank: patch.vip_rank ?? b.vip_rank,
            }
          : b
      )
    )

    try {
      await call("", {
        method: "POST",
        body: JSON.stringify({
          action: "update_buyer",
          user_id: userId,
          buyer_tier: patch.buyer_tier,
          vip_rank: patch.vip_rank,
        }),
      })
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to save buyer")
      // reload to revert to source of truth
      await load()
    } finally {
      setSavingByUser((m) => ({ ...m, [userId]: false }))
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
          <div className="text-sm font-semibold">Buyer Rankings</div>
          <div className="mt-0.5 text-xs text-white/60">
            {loading ? "Loading…" : `${vipCount} VIP / ${buyers.length} total buyers`}
          </div>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
        >
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
                <th className="px-4 py-3">Tier</th>
                <th className="px-4 py-3">VIP Rank</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">User ID</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {buyers
                .slice()
                .sort((a, b) => {
                  // VIPs first, then rank desc, then created
                  const aVip = (a.buyer_tier ?? "regular") === "vip" ? 1 : 0
                  const bVip = (b.buyer_tier ?? "regular") === "vip" ? 1 : 0
                  if (aVip !== bVip) return bVip - aVip

                  const ar = safeRank(a.vip_rank)
                  const br = safeRank(b.vip_rank)
                  if (ar !== br) return br - ar

                  return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
                })
                .map((b) => {
                  const name = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || "—"
                  const tier: BuyerTier = (b.buyer_tier as BuyerTier) ?? "regular"
                  const rank = safeRank(b.vip_rank)
                  const saving = !!savingByUser[b.user_id]

                  return (
                    <tr key={b.user_id} className="hover:bg-white/5">
                      <td className="px-4 py-3 font-semibold">{name}</td>
                      <td className="px-4 py-3 text-white/80">{b.email ?? "—"}</td>

                      <td className="px-4 py-3">
                        <select
                          value={tier}
                          disabled={saving}
                          onChange={(e) => {
                            const next = (e.target.value as BuyerTier) || "regular"
                            const patch: any = { buyer_tier: next }
                            // If downgrading to regular, also zero rank for cleanliness
                            if (next === "regular") patch.vip_rank = 0
                            saveBuyer(b.user_id, patch)
                          }}
                          className="rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                        >
                          <option value="regular">Regular</option>
                          <option value="vip">VIP</option>
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={999}
                            value={rank}
                            disabled={saving || tier !== "vip"}
                            onChange={(e) => {
                              const next = safeRank(e.target.value)
                              // live update UI only; save on blur
                              setBuyers((prev) =>
                                prev.map((x) =>
                                  x.user_id === b.user_id ? { ...x, vip_rank: next } : x
                                )
                              )
                            }}
                            onBlur={(e) => {
                              const next = safeRank(e.target.value)
                              saveBuyer(b.user_id, { vip_rank: next })
                            }}
                            className={`w-24 rounded-xl border px-3 py-2 text-sm outline-none focus:border-white/30 ${
                              tier !== "vip"
                                ? "border-white/10 bg-black/20 text-white/40"
                                : "border-white/15 bg-black/40 text-white"
                            }`}
                          />

                          {saving && <span className="text-xs text-white/50">Saving…</span>}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-white/70">
                        {new Date(b.created_at).toLocaleDateString()}
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
        VIP Rank is only used for VIP buyers. Higher rank means higher priority (we’ll use this when
        we implement “first dibs” + “exclusive VIP access”).
      </div>
    </div>
  )
}