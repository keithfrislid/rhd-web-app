"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { formatMoney } from "@/lib/properties"

import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"

type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn"

type OfferRow = {
  id: string
  user_id: string
  buyer: {
    user_id: string
    email: string | null
    first_name: string | null
    last_name: string | null
  } | null
  offer_price: number
  notes: string | null
  status: OfferStatus
  created_at: string
}

function shortId(id: string) {
  if (!id) return ""
  return `${id.slice(0, 6)}…${id.slice(-4)}`
}

function statusPill(status: OfferStatus) {
  if (status === "accepted") return <Badge variant="success">Accepted</Badge>
  if (status === "rejected") return <Badge variant="muted">Rejected</Badge>
  if (status === "withdrawn") return <Badge variant="muted">Withdrawn</Badge>
  return <Badge variant="accent">Pending</Badge>
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

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-offers/property/${propertyId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)

      setOffers((Array.isArray(json?.offers) ? json.offers : []) as OfferRow[])
    } catch (e: any) {
      setOffers([])
      setErrorMsg(e?.message ?? "Failed to load offers")
    } finally {
      setLoading(false)
    }
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
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)]">Offers</div>
            <div className="mt-1 truncate text-base font-semibold text-[var(--text)]">
              {propertyAddress}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">Property ID: {shortId(propertyId)}</div>
          </div>

          <Button variant="secondary" onClick={loadOffers}>
            Refresh
          </Button>
        </div>

        {errorMsg && (
          <div className="mt-3 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--text)]">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        {loading ? (
          <div className="text-sm text-[var(--muted)]">Loading offers…</div>
        ) : offers.length === 0 ? (
          <div className="text-sm text-[var(--muted)]">No offers yet.</div>
        ) : (
          <div className="space-y-2">
            {offers.map((o) => {
              const buyerName = `${o.buyer?.first_name ?? ""} ${o.buyer?.last_name ?? ""}`.trim()
              const buyerLabel = buyerName || o.buyer?.email || shortId(o.user_id)
              const disabled = o.status !== "pending" || busyId === o.id

              return (
                <Card key={o.id} className="p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-lg font-extrabold text-[var(--text)]">
                          {formatMoney(o.offer_price)}
                        </div>
                        {statusPill(o.status)}
                      </div>

                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Buyer: {buyerLabel}
                        {o.buyer?.email ? ` (${o.buyer.email})` : ""} •{" "}
                        {new Date(o.created_at).toLocaleString()}
                      </div>

                      {o.notes && (
                        <div className="mt-2 whitespace-pre-wrap text-sm text-[var(--text)]/90">
                          {o.notes}
                        </div>
                      )}
                    </div>

                    <div className="shrink-0">
                      <Button
                        variant={disabled ? "secondary" : "primary"}
                        disabled={disabled}
                        onClick={() => acceptOffer(o.id)}
                      >
                        {busyId === o.id ? "Accepting…" : "Accept"}
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <div className="mt-3 text-[11px] text-[var(--muted)]">
          Accepting an offer will: mark the property Under Contract, lock offers, and reject other
          pending offers.
        </div>
      </div>
    </Card>
  )
}