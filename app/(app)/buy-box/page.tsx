"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { MIDDLE_TN_COUNTIES } from "@/lib/tnCounties"

type BuyBoxRow = {
  user_id: string
  counties: string[]
  updated_at: string | null
}

function normalizeCounty(name: string) {
  return name.trim()
}

export default function BuyBoxPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const selectedList = useMemo(() => Array.from(selected).sort(), [selected])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setErrorMsg(null)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) {
          setLoading(false)
          setErrorMsg("No session")
        }
        return
      }

      const { data, error } = await supabase
        .from("buyer_buy_boxes")
        .select("user_id,counties,updated_at")
        .eq("user_id", user.id)
        .maybeSingle()

      if (!cancelled) {
        if (error) {
          setErrorMsg(error.message)
          setSelected(new Set())
        } else {
          const row = data as BuyBoxRow | null
          const counties = Array.isArray(row?.counties) ? row!.counties : []
          setSelected(new Set(counties.map(normalizeCounty)))
        }
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggle = (county: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(county)) next.delete(county)
      else next.add(county)
      return next
    })
  }

  const save = async () => {
    if (saving) return
    setSaving(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("No session")

      const counties = selectedList

      const { error } = await supabase
        .from("buyer_buy_boxes")
        .upsert(
          {
            user_id: user.id,
            counties,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        )

      if (error) throw error

      setSuccessMsg("Saved your Buy Box.")
      setTimeout(() => setSuccessMsg(null), 3000)
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to save.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Buy Box</h1>
          <p className="mt-1 text-sm text-white/70">
            Choose counties you want to be notified about. (Email blasts will be wired next.)
          </p>
        </div>

        <button
          onClick={save}
          disabled={loading || saving}
          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
            loading || saving
              ? "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
              : "bg-white text-black hover:opacity-90"
          }`}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {successMsg && (
        <div className="mt-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="text-sm font-semibold">Counties</div>
          <div className="text-xs text-white/60">
            {loading ? "Loading…" : `${selected.size} selected`}
          </div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-white/70">Loading your buy box…</div>
        ) : (
          <div className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {MIDDLE_TN_COUNTIES.map((c) => {
                const on = selected.has(c)
                return (
                  <button
                    key={c}
                    onClick={() => toggle(c)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                      on
                        ? "border-white/40 bg-white text-black"
                        : "border-white/15 bg-black/30 text-white/80 hover:bg-white/5"
                    }`}
                  >
                    <span className="font-semibold">{c}</span>
                    <span
                      className={`text-[11px] font-extrabold ${
                        on ? "text-black/70" : "text-white/40"
                      }`}
                    >
                      {on ? "ON" : "OFF"}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 text-xs text-white/50">
              Tip: Keep this broad for now. We’ll add price ranges, bed/bath, and ARV constraints later.
            </div>
          </div>
        )}
      </div>
    </main>
  )
}