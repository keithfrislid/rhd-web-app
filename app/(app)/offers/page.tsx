"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import DealSheetPanel from "@/components/DealSheetPanel"
import { formatMoney, type Property } from "@/lib/properties"

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
  const base =
    "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold"

  if (status === "accepted") {
    return (
      <span
        className={`${base} bg-emerald-500/15 border-emerald-400/30 text-emerald-200`}
      >
        Accepted
      </span>
    )
  }
  if (status === "rejected") {
    return (
      <span className={`${base} bg-white/5 border-white/10 text-white/60`}>
        Rejected
      </span>
    )
  }
  return (
    <span className={`${base} bg-sky-500/15 border-sky-400/30 text-sky-200`}>
      Pending
    </span>
  )
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My Offers</h1>
          <p className="mt-1 text-sm text-white/70">
            Track pending, accepted, and rejected offers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadOffers}
            className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Summary + tabs */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase tracking-wide text-white/60">
            Summary
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/60">Pending</div>
              <div className="mt-1 text-lg font-extrabold">
                {summary.pending}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/60">Accepted</div>
              <div className="mt-1 text-lg font-extrabold">
                {summary.accepted}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <div className="text-[11px] text-white/60">Rejected</div>
              <div className="mt-1 text-lg font-extrabold">
                {summary.rejected}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-1 rounded-xl border border-white/15 bg-black/40 p-1">
            <button
              onClick={() => setTab("pending")}
              className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                tab === "pending"
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setTab("accepted")}
              className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                tab === "accepted"
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Accepted
            </button>
            <button
              onClick={() => setTab("rejected")}
              className={`flex-1 rounded-lg px-2 py-2 text-sm font-semibold transition ${
                tab === "rejected"
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Rejected
            </button>
          </div>

          <div className="mt-3 text-[11px] text-white/60">
            Offers are private. You only see your own offers and status updates.
          </div>
        </div>

        {/* Offer list */}
        <div className="lg:col-span-3 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">
              {tab === "pending"
                ? "Pending Offers"
                : tab === "accepted"
                ? "Accepted Offers"
                : "Rejected Offers"}
            </div>
            <div className="text-xs text-white/60">
              {fetching ? "Loading…" : `${visible.length} total`}
            </div>
          </div>

          {errorMsg && (
            <div className="p-4 border-b border-white/10">
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                {errorMsg}
              </div>
            </div>
          )}

          {fetching ? (
            <div className="p-4 text-sm text-white/70">Loading offers…</div>
          ) : visible.length === 0 ? (
            <div className="p-4 text-sm text-white/70">
              {tab === "pending" &&
                "No pending offers. Submit an offer from a deal sheet."}
              {tab === "accepted" && "No accepted offers yet."}
              {tab === "rejected" && "No rejected offers."}
            </div>
          ) : (
            <div className="divide-y divide-white/10">
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
                    className="w-full text-left px-4 py-3 hover:bg-white/5 transition"
                    disabled={!p}
                    title={!p ? "Property missing (deleted)" : "Open deal sheet"}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="font-semibold truncate">
                            {p?.address ?? "Property unavailable"}
                          </div>
                          {statusPill(o.status)}
                        </div>

                        <div className="mt-1 text-xs text-white/60">
                          Your offer:{" "}
                          <span className="text-white/85 font-semibold">
                            {formatMoney(o.offer_price)}
                          </span>
                          {" • "}
                          {new Date(o.created_at).toLocaleString()}
                        </div>

                        {p && (
                          <div className="mt-1 text-[12px] text-white/70">
                            {p.beds} bd • {p.baths} ba •{" "}
                            {p.sqft.toLocaleString()} sqft • {p.acres} ac
                          </div>
                        )}
                      </div>

                      {p && (
                        <div className="shrink-0 text-right">
                          <div className="text-[11px] text-white/60">Spread</div>
                          <div className="text-sm font-extrabold">
                            {formatMoney(s ?? 0)}
                          </div>
                        </div>
                      )}
                    </div>

                    {o.notes && (
                      <div className="mt-2 text-sm text-white/70 line-clamp-2">
                        Notes: {o.notes}
                      </div>
                    )}

                    <div className="mt-2 text-[10px] text-white/50">
                      Tap to open deal sheet →
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Deal sheet overlay */}
      {selected && (
        <div className="fixed inset-x-0 bottom-0 md:inset-y-0 md:right-4 md:left-auto md:top-24 md:bottom-auto md:w-[420px] z-[4000] pointer-events-auto">
          <div className="mx-3 md:mx-0">
            <DealSheetPanel selected={selected} onClose={() => setSelected(null)} />
          </div>
        </div>
      )}
    </main>
  )
}
