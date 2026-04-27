"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

type ActivityRow = {
  user_id: string
  visit_count: number
  first_visited_at: string
  last_visited_at: string
  profiles: {
    first_name: string | null
    last_name: string | null
    email: string | null
    role: string | null
  } | null
}

function displayName(row: ActivityRow) {
  const p = row.profiles
  if (!p) return row.user_id.slice(0, 8) + "…"
  const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim()
  return name || p.email || row.user_id.slice(0, 8) + "…"
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export default function AdminAnalyticsPanel() {
  const [rows, setRows] = useState<ActivityRow[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from("user_activity")
      .select(`
        user_id,
        visit_count,
        first_visited_at,
        last_visited_at,
        profiles ( first_name, last_name, email, role )
      `)
      .order("last_visited_at", { ascending: false })

    if (error) {
      setErrorMsg(error.message)
    } else {
      setRows((data ?? []) as ActivityRow[])
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const uniqueVisitors = rows.length
  const totalVisits = rows.reduce((sum, r) => sum + r.visit_count, 0)
  const activeToday = rows.filter((r) => {
    const diff = Date.now() - new Date(r.last_visited_at).getTime()
    return diff < 86400000
  }).length

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Analytics</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">
              Visitor activity — tracked once per day per user.
            </div>
          </div>
          <Button variant="secondary" onClick={load}>Refresh</Button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--text)]">
            {errorMsg}
          </div>
        )}
      </Card>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text)]">{uniqueVisitors}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">Unique visitors</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text)]">{totalVisits}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">Total visits</div>
        </Card>
        <Card className="p-4 text-center">
          <div className="text-2xl font-bold text-[var(--text)]">{activeToday}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">Active today</div>
        </Card>
      </div>

      {/* Per-user table */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text)]">Visitor breakdown</div>
        </div>

        {loading ? (
          <div className="p-4 text-sm text-[var(--muted)]">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-4 text-sm text-[var(--muted)]">No visit data yet.</div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <div key={row.user_id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-[var(--text)]">{displayName(row)}</div>
                  <div className="text-xs text-[var(--muted)]">
                    {row.profiles?.email ?? row.user_id}
                    {row.profiles?.role ? ` · ${row.profiles.role}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-right text-xs text-[var(--muted)]">
                  <div>
                    <div className="text-base font-semibold text-[var(--text)]">{row.visit_count}</div>
                    <div>visits</div>
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text)]">{timeAgo(row.last_visited_at)}</div>
                    <div>last seen</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
