"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import { MIDDLE_TN_COUNTIES } from "@/lib/tnCounties"
import { PageShell } from "@/components/ui/PageShell"
import { Card, CardContent, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"

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
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Buy Box</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choose counties you want to be notified about. (Email blasts will be wired next.)
          </p>
        </div>

        <Button onClick={save} disabled={loading || saving} variant="primary">
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {successMsg && (
        <div className="mt-4 rounded-2xl border border-[var(--success)]/30 bg-[var(--success)]/10 p-4 text-sm text-[var(--success)]">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4 text-sm text-[var(--danger)]">
          {errorMsg}
        </div>
      )}

      <Card className="mt-6 overflow-hidden">
        <CardHeader className="flex items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="text-sm font-semibold">Counties</div>
          <Badge variant="muted">{loading ? "Loading…" : `${selected.size} selected`}</Badge>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="text-sm text-[var(--muted)]">Loading your buy box…</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MIDDLE_TN_COUNTIES.map((c) => {
                  const on = selected.has(c)
                  return (
                    <Button
                      key={c}
                      onClick={() => toggle(c)}
                      variant={on ? "primary" : "secondary"}
                      size="sm"
                      className={[
                        "h-auto w-full justify-between rounded-xl px-3 py-2 text-left",
                        on ? "text-black" : "",
                      ].join(" ")}
                    >
                      <span className="font-semibold">{c}</span>
                      <span className={on ? "text-black/70" : "text-[var(--muted)]"}>
                        {on ? "ON" : "OFF"}
                      </span>
                    </Button>
                  )
                })}
              </div>

              <div className="mt-4 text-xs text-[var(--muted)]">
                Tip: Keep this broad for now. We’ll add price ranges, bed/bath, and ARV constraints later.
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </PageShell>
  )
}