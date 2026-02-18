"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatMoney } from "@/lib/properties"

type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn"

type OfferRow = {
  id: string
  user_id: string
  offer_price: number
  notes: string | null
  status: OfferStatus
  created_at: string
}

function shortId(id: string) {
  if (!id) return ""
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function pill(status: OfferStatus) {
  const base =
    "inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold"

  if (status === "accepted") {
    return (
      <span className={`${base} bg-emerald-500/15 border-emerald-400/30 text-emerald-200`}>
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

export default function AdminOffersPanel({
  propertyId,
  propertyAddress,
  onAccepted,
}: {
  propertyId: string
  propertyAddress: string
  onAccepted: () => void
}) {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const loadOffers = async () => {
    setLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from("offers")
      .select("id,user_id,offer_price,notes,status,created_at")
      .eq("property_id", propertyId)
      .order("created_at", { ascending: true })

    if (error) {
      setOffers([])
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    setOffers((data ?? []) as OfferRow[])
    setLoading(false)
  }

  useEffect(() => {
    loadOffers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId])

  const acceptOffer = async (offerId: string) => {
    setBusyId(offerId)
    setErrorMsg(null)

    // 1) accept chosen offer
    const { error: acceptErr } = await supabase
      .from("offers")
      .update({ status: "accepted" })
      .eq("id", offerId)

    if (acceptErr) {
      setErrorMsg(acceptErr.message)
      setBusyId(null)
      return
    }

    // 2) reject all other pending offers for this property
    const { error: rejectErr } = await supabase
      .from("offers")
      .update({ status: "rejected" })
      .eq("property_id", propertyId)
      .neq("id", offerId)
      .eq("status", "pending")

    if (rejectErr) {
      setErrorMsg(rejectErr.message)
      setBusyId(null)
      await loadOffers()
      return
    }

    // 3) lock property + mark under contract
    const { error: propErr } = await supabase
      .from("properties")
      .update({
        status: "Under Contract",
        accepted_offer_id: offerId,
        is_accepting_offers: false,
      })
      .eq("id", propertyId)

    if (propErr) {
      setErrorMsg(propErr.message)
      setBusyId(null)
      await loadOffers()
      return
    }

    setBusyId(null)
    await loadOffers()
    onAccepted()
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-white/60">
            Offers
          </div>
          <div className="mt-1 text-base font-semibold truncate">
            {propertyAddress}
          </div>
          <div className="mt-1 text-xs text-white/60">
            Property ID: {shortId(propertyId)}
          </div>
        </div>

        <button
          onClick={loadOffers}
          className="shrink-0 rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
        >
          Refresh
        </button>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="mt-4 text-sm text-white/70">Loading offers…</div>
      ) : offers.length === 0 ? (
        <div className="mt-4 text-sm text-white/70">No offers yet.</div>
      ) : (
        <div className="mt-4 space-y-2">
          {offers.map((o) => (
            <div
              key={o.id}
              className="rounded-2xl border border-white/10 bg-black/30 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-extrabold">
                      {formatMoney(o.offer_price)}
                    </div>
                    {pill(o.status)}
                  </div>

                  <div className="mt-1 text-xs text-white/60">
                    Buyer: {shortId(o.user_id)} •{" "}
                    {new Date(o.created_at).toLocaleString()}
                  </div>

                  {o.notes && (
                    <div className="mt-2 text-sm text-white/80 whitespace-pre-wrap">
                      {o.notes}
                    </div>
                  )}
                </div>

                <div className="shrink-0">
                  <button
                    disabled={o.status !== "pending" || busyId === o.id}
                    onClick={() => acceptOffer(o.id)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      o.status !== "pending" || busyId === o.id
                        ? "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
                        : "bg-white text-black hover:opacity-90"
                    }`}
                  >
                    {busyId === o.id ? "Accepting…" : "Accept"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-[11px] text-white/60">
        Accepting an offer will: mark the property Under Contract, lock offers,
        and reject other pending offers.
      </div>
    </div>
  )
}
