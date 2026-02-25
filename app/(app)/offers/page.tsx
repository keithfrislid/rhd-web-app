"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import DealSheetPanel from "@/components/DealSheetPanel"
import { formatMoney, type Property } from "@/lib/properties"

import { PageShell } from "@/components/ui/PageShell"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"

type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn"

type OfferWithProperty = {
  id: string
  offer_price: number
  notes: string | null
  status: OfferStatus
  created_at: string
  property: any // mapped into Property below
}

type Tab = "pending" | "accepted" | "rejected"

function statusPill(status: OfferStatus) {
  if (status === "accepted") return <Badge variant="success">Accepted</Badge>
  if (status === "rejected") return <Badge variant="muted">Rejected</Badge>
  return <Badge variant="accent">Pending</Badge>
}

function asProperty(row: any): Property {
  return {
    id: row.id,
    address: row.address,
    price: row.price,
    beds: row.beds,
    baths: Number(row.baths),
    sqft: row.sqft,
    acres: Number(row.acres),
    arv: row.arv,
    repairs: row.repairs,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url ?? "https://photos.google.com/",
    status: row.status,
    offerDeadline: row.offer_deadline ?? null,
    isAcceptingOffers:
      typeof row.is_accepting_offers === "boolean"
        ? row.is_accepting_offers
        : true,
    acceptedOfferId: row.accepted_offer_id ?? null,
  }
}

function spread(p: Property) {
  return p.arv - p.price - p.repairs
}

export default function OffersPage() {
  const [offers, setOffers] = useState<OfferWithProperty[]>([])
  const [fetching, setFetching] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>("pending")
  const [selected, setSelected] = useState<Property | null>(null)

  const loadOffers = async () => {
    setFetching(true)
    setErrorMsg(null)

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    // AuthShell should prevent this, but keep as a safe guard:
    if (userErr || !user) {
      setOffers([])
      setFetching(false)
      return
    }

    const { data, error } = await supabase
      .from("offers")
      .select(
        `
        id,
        offer_price,
        notes,
        status,
        created_at,
        property:properties!offers_property_id_fkey(
          id,address,price,beds,baths,sqft,acres,arv,repairs,lat,lng,photo_url,status,created_at,
          offer_deadline,is_accepting_offers,accepted_offer_id
        )
      `
      )
      .eq("user_id", user.id)
      .in("status", ["pending", "accepted", "rejected"]) // withdrawn rows are deleted in your system
      .order("created_at", { ascending: false })

    if (error) {
      setOffers([])
      setErrorMsg(error.message)
      setFetching(false)
      return
    }

    setOffers((data ?? []) as OfferWithProperty[])
    setFetching(false)
  }

  useEffect(() => {
    loadOffers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Refresh when you submit/withdraw from deal sheet
  useEffect(() => {
    const handler = () => loadOffers()
    window.addEventListener("rhd:offers-changed", handler)
    return () => window.removeEventListener("rhd:offers-changed", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pending = useMemo(
    () => offers.filter((o) => o.status === "pending"),
    [offers]
  )
  const accepted = useMemo(
    () => offers.filter((o) => o.status === "accepted"),
    [offers]
  )
  const rejected = useMemo(
    () => offers.filter((o) => o.status === "rejected"),
    [offers]
  )

  const visible =
    tab === "pending" ? pending : tab === "accepted" ? accepted : rejected

  const summary = useMemo(() => {
    return {
      pending: pending.length,
      accepted: accepted.length,
      rejected: rejected.length,
    }
  }, [pending.length, accepted.length, rejected.length])

  return (
    <main className="w-full">
      <PageShell className="space-y-4">
        {/* Header */}
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text)]">My Offers</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Track pending, accepted, and rejected offers.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={loadOffers}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          {/* Summary + Tabs */}
          <Card className="lg:col-span-2 overflow-hidden">
            <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Summary
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <Card className="p-3">
                  <div className="text-[11px] text-[var(--muted)]">Pending</div>
                  <div className="mt-1 text-lg font-extrabold text-[var(--text)]">
                    {summary.pending}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-[11px] text-[var(--muted)]">Accepted</div>
                  <div className="mt-1 text-lg font-extrabold text-[var(--text)]">
                    {summary.accepted}
                  </div>
                </Card>
                <Card className="p-3">
                  <div className="text-[11px] text-[var(--muted)]">Rejected</div>
                  <div className="mt-1 text-lg font-extrabold text-[var(--text)]">
                    {summary.rejected}
                  </div>
                </Card>
              </div>

              <div className="mt-4 flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-1">
                <button
                  onClick={() => setTab("pending")}
                  className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                    tab === "pending"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text)] hover:bg-black/20"
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setTab("accepted")}
                  className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                    tab === "accepted"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text)] hover:bg-black/20"
                  }`}
                >
                  Accepted
                </button>
                <button
                  onClick={() => setTab("rejected")}
                  className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                    tab === "rejected"
                      ? "bg-[var(--accent)] text-white"
                      : "text-[var(--text)] hover:bg-black/20"
                  }`}
                >
                  Rejected
                </button>
              </div>

              <div className="mt-3 text-[11px] text-[var(--muted)]">
                Offers are private. You only see your own offers and status updates.
              </div>
            </div>
          </Card>

          {/* Offer list */}
          <Card className="lg:col-span-3 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--text)]">
                {tab === "pending"
                  ? "Pending Offers"
                  : tab === "accepted"
                  ? "Accepted Offers"
                  : "Rejected Offers"}
              </div>
              <div className="text-xs text-[var(--muted)]">
                {fetching ? "Loading…" : `${visible.length} total`}
              </div>
            </div>

            {errorMsg && (
              <div className="border-b border-[var(--border)] p-4">
                <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--text)]">
                  {errorMsg}
                </div>
              </div>
            )}

            {fetching ? (
              <div className="p-4 text-sm text-[var(--muted)]">Loading offers…</div>
            ) : visible.length === 0 ? (
              <div className="p-4 text-sm text-[var(--muted)]">
                {tab === "pending" &&
                  "No pending offers. Submit an offer from a deal sheet."}
                {tab === "accepted" && "No accepted offers yet."}
                {tab === "rejected" && "No rejected offers."}
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {visible.map((o) => {
                  const p = o.property ? asProperty(o.property) : null
                  const s = p ? spread(p) : null

                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => {
                        if (p) setSelected(p)
                      }}
                      className="w-full text-left px-4 py-3 transition hover:bg-black/10"
                      disabled={!p}
                      title={!p ? "Property missing (deleted)" : "Open deal sheet"}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="truncate font-semibold text-[var(--text)]">
                              {p?.address ?? "Property unavailable"}
                            </div>
                            {statusPill(o.status)}
                          </div>

                          <div className="mt-1 text-xs text-[var(--muted)]">
                            Your offer:{" "}
                            <span className="font-semibold text-[var(--text)]">
                              {formatMoney(o.offer_price)}
                            </span>
                            {" • "}
                            {new Date(o.created_at).toLocaleString()}
                          </div>

                          {p && (
                            <div className="mt-1 text-[12px] text-[var(--muted)]">
                              {p.beds} bd • {p.baths} ba •{" "}
                              {p.sqft.toLocaleString()} sqft • {p.acres} ac
                            </div>
                          )}
                        </div>

                        {p && (
                          <div className="shrink-0 text-right">
                            <div className="text-[11px] text-[var(--muted)]">Spread</div>
                            <div className="text-sm font-extrabold text-[var(--text)]">
                              {formatMoney(s ?? 0)}
                            </div>
                          </div>
                        )}
                      </div>

                      {o.notes && (
                        <div className="mt-2 line-clamp-2 text-sm text-[var(--muted)]">
                          Notes: {o.notes}
                        </div>
                      )}

                      <div className="mt-2 text-[10px] text-[var(--muted)]">
                        Tap to open deal sheet →
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>
        </div>
      </PageShell>

      {/* Deal sheet overlay */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-[4000] pointer-events-auto md:inset-y-0 md:right-4 md:left-auto md:top-24 md:bottom-auto md:w-[420px]">
          <div className="mx-3 md:mx-0">
            <DealSheetPanel selected={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </main>
  )
}