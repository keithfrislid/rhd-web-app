"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/cn"

type PendingUser = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  created_at: string
}

type ApprovedUser = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  buyer_tier?: "regular" | "vip" | null
  vip_rank?: number | null
  created_at: string
}

function displayName(u: { first_name: string | null; last_name: string | null; email: string | null; user_id: string }) {
  const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()
  return name || u.email || `${u.user_id.slice(0, 6)}…${u.user_id.slice(-4)}`
}

export default function AdminUsersPanel() {
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [pending, setPending] = useState<PendingUser[]>([])
  const [approved, setApproved] = useState<ApprovedUser[]>([])

  const [busyId, setBusyId] = useState<string | null>(null)

  const [search, setSearch] = useState("")

  const load = async () => {
    setLoading(true)
    setErrorMsg(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)

      setPending((json?.pending ?? []) as PendingUser[])
      setApproved((json?.approved ?? []) as ApprovedUser[])
    } catch (e: any) {
      setPending([])
      setApproved([])
      setErrorMsg(e?.message ?? "Failed to load users.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const approve = async (userId: string) => {
    if (busyId) return
    setBusyId(userId)
    setErrorMsg(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Approve failed (${res.status})`)

      await load()
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to approve user.")
    } finally {
      setBusyId(null)
    }
  }

  const deny = async (userId: string) => {
    if (busyId) return
    const ok = window.confirm("Deny / remove this pending user?")
    if (!ok) return

    setBusyId(userId)
    setErrorMsg(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users/deny`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Deny failed (${res.status})`)

      await load()
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to deny user.")
    } finally {
      setBusyId(null)
    }
  }

  const filteredApproved = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return approved

    return approved.filter((u) => {
      const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase()
      const email = (u.email ?? "").toLowerCase()
      return name.includes(q) || email.includes(q) || u.user_id.toLowerCase().includes(q)
    })
  }, [approved, search])

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Users</div>
            <div className="mt-0.5 text-xs text-[var(--muted)]">
              Approve new buyers and review the user list.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={load}>
              Refresh
            </Button>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--text)]">
            {errorMsg}
          </div>
        )}
      </Card>

      {/* Pending approvals */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-[var(--text)]">Pending approvals</div>
            <Badge variant={pending.length > 0 ? "warning" : "muted"}>{pending.length}</Badge>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            These users signed up and are waiting for admin approval.
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-[var(--muted)]">Loading…</div>
          ) : pending.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">No pending users.</div>
          ) : (
            <div className="space-y-2">
              {pending.map((u) => {
                const busy = busyId === u.user_id
                return (
                  <Card key={u.user_id} className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[var(--text)]">{displayName(u)}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {u.email ? `Email: ${u.email} • ` : ""}
                          Signed up: {new Date(u.created_at).toLocaleString()}
                        </div>
                        <div className="mt-1 text-[11px] text-[var(--muted)]">ID: {u.user_id}</div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button variant="primary" onClick={() => approve(u.user_id)} disabled={busy}>
                          {busy ? "Approving…" : "Approve"}
                        </Button>
                        <Button variant="danger" onClick={() => deny(u.user_id)} disabled={busy}>
                          {busy ? "Working…" : "Deny"}
                        </Button>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Approved users */}
      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--text)]">Approved users</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                Search and review currently approved buyers.
              </div>
            </div>

            <div className="w-full md:w-72">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name/email/ID…" />
            </div>
          </div>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="text-sm text-[var(--muted)]">Loading…</div>
          ) : filteredApproved.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">No users match that search.</div>
          ) : (
            <div className="space-y-2">
              {filteredApproved.map((u) => (
                <Card key={u.user_id} className="p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold text-[var(--text)]">{displayName(u)}</div>
                        {(u.buyer_tier ?? "regular") === "vip" ? (
                          <Badge variant="accent">VIP</Badge>
                        ) : (
                          <Badge variant="muted">Regular</Badge>
                        )}
                        {u.vip_rank ? <Badge variant="muted">Rank {u.vip_rank}</Badge> : null}
                      </div>

                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {u.email ? `Email: ${u.email} • ` : ""}
                        Approved: {new Date(u.created_at).toLocaleString()}
                      </div>

                      <div className="mt-1 text-[11px] text-[var(--muted)]">ID: {u.user_id}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-3 text-[11px] text-[var(--muted)]">
            Buyer tier + ranking changes are managed in the Buyer Rankings tab.
          </div>
        </div>
      </Card>
    </div>
  )
}