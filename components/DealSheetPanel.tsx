"use client"

import { useEffect, useMemo, useState } from "react"
import type { Property } from "@/lib/properties"
import { formatMoney } from "@/lib/properties"
import { supabase } from "@/lib/supabase"

type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn"

type OfferRow = {
  id: string
  property_id: string
  user_id: string
  offer_price: number
  notes: string | null
  status: OfferStatus
  created_at: string
  updated_at: string
}

function formatDeadline(ts: string | null | undefined) {
  if (!ts) return null
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function DealSheetPanel({
  selected,
  onClose,
}: {
  selected: Property
  onClose: () => void
}) {
  const spread = selected.arv - selected.price - selected.repairs

  // ---- Saved state (existing feature)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(true)

  // ---- Offer state (new feature)
  const [offerCount, setOfferCount] = useState<number | null>(null)
  const [userOffer, setUserOffer] = useState<OfferRow | null>(null)
  const [offerLoading, setOfferLoading] = useState(true)

  // ---- Offer submit UI
  const [showOfferForm, setShowOfferForm] = useState(false)
  const [offerPrice, setOfferPrice] = useState<string>("")
  const [offerNotes, setOfferNotes] = useState<string>("")
  const [submittingOffer, setSubmittingOffer] = useState(false)
  const [offerError, setOfferError] = useState<string | null>(null)

  const deadlineLabel = useMemo(
    () => formatDeadline(selected.offerDeadline),
    [selected.offerDeadline]
  )

  const offersClosed = useMemo(() => {
    if (selected.isAcceptingOffers === false) return true
    if (selected.acceptedOfferId) return true
    if (!selected.offerDeadline) return false
    const d = new Date(selected.offerDeadline)
    if (Number.isNaN(d.getTime())) return false
    return Date.now() > d.getTime()
  }, [selected.isAcceptingOffers, selected.acceptedOfferId, selected.offerDeadline])

  // Reusable: fetch offer count + user's offer for this property
  const refreshOfferData = async () => {
    setOfferLoading(true)
    setOfferError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 1) Offer count (safe view)
    const { data: countRow, error: countErr } = await supabase
      .from("property_offer_counts")
      .select("offer_count")
      .eq("property_id", selected.id)
      .maybeSingle()

    if (countErr) {
      console.warn("Offer count fetch failed:", countErr.message)
      setOfferCount(null)
    } else {
      setOfferCount((countRow as any)?.offer_count ?? 0)
    }

    // 2) User's own offer (RLS restricted)
    if (!user) {
      setUserOffer(null)
      setOfferLoading(false)
      return
    }

    const { data: offerRow, error: offerErr } = await supabase
      .from("offers")
      .select("id,property_id,user_id,offer_price,notes,status,created_at,updated_at")
      .eq("property_id", selected.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (offerErr) {
      console.warn("User offer fetch failed:", offerErr.message)
      setUserOffer(null)
    } else {
      setUserOffer((offerRow as OfferRow) ?? null)
    }

    setOfferLoading(false)
  }

  // Check saved + offers whenever the selected property changes
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // Reset per-property UI
      setShowOfferForm(false)
      setOfferPrice("")
      setOfferNotes("")
      setOfferError(null)

      // ---- Saved check
      setChecking(true)
      setIsSaved(false)

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (userErr || !user) {
        setChecking(false)
      } else {
        const { data, error } = await supabase
          .from("saved_properties")
          .select("id")
          .eq("user_id", user.id)
          .eq("property_id", selected.id)
          .limit(1)

        if (!cancelled) {
          if (error) {
            console.warn("Check saved_properties failed:", error.message)
            setIsSaved(false)
          } else {
            setIsSaved((data?.length ?? 0) > 0)
          }
          setChecking(false)
        }
      }

      // ---- Offer data
      if (!cancelled) {
        await refreshOfferData()
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.id])

  const toggleSave = async () => {
    if (saving || checking) return
    setSaving(true)

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      console.warn("No authenticated user found for save toggle.")
      setSaving(false)
      return
    }

    if (isSaved) {
      const { error } = await supabase
        .from("saved_properties")
        .delete()
        .eq("user_id", user.id)
        .eq("property_id", selected.id)

      if (error) {
        console.warn("Unsave failed:", error.message)
      } else {
        setIsSaved(false)
        window.dispatchEvent(new CustomEvent("rhd:saves-changed"))
      }
    } else {
      const { error } = await supabase.from("saved_properties").insert({
        user_id: user.id,
        property_id: selected.id,
      })

      if (error) {
        console.warn("Save failed:", error.message)
      } else {
        setIsSaved(true)
        window.dispatchEvent(new CustomEvent("rhd:saves-changed"))
      }
    }

    setSaving(false)
  }

  const submitOffer = async () => {
    if (submittingOffer) return
    setOfferError(null)

    const raw = offerPrice.replace(/[^0-9.]/g, "")
    const priceNum = Number(raw)

    if (!raw || !Number.isFinite(priceNum) || priceNum <= 0) {
      setOfferError("Enter a valid offer price.")
      return
    }

    setSubmittingOffer(true)

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser()

    if (userErr || !user) {
      setOfferError("You must be logged in to submit an offer.")
      setSubmittingOffer(false)
      return
    }

    if (offersClosed) {
      setOfferError("Offers are closed for this property.")
      setSubmittingOffer(false)
      return
    }

    // If an offer already exists (even withdrawn), UPDATE it instead of inserting a new row
    const { data: existingOffer, error: existingErr } = await supabase
      .from("offers")
      .select("id,status")
      .eq("property_id", selected.id)
      .eq("user_id", user.id)
      .maybeSingle()

    if (existingErr) {
      console.warn("Existing offer check failed:", existingErr.message)
    }

    if (existingOffer?.id) {
      const { error } = await supabase
        .from("offers")
        .update({
          offer_price: priceNum,
          notes: offerNotes.trim() ? offerNotes.trim() : null,
          status: "pending",
        })
        .eq("id", existingOffer.id)

      if (error) {
        console.warn("Offer update failed:", error.message)
        setOfferError(error.message)
        setSubmittingOffer(false)
        await refreshOfferData()
        return
      }
    } else {
      const { error } = await supabase.from("offers").insert({
        user_id: user.id,
        property_id: selected.id,
        offer_price: priceNum,
        notes: offerNotes.trim() ? offerNotes.trim() : null,
      })

      if (error) {
        console.warn("Offer insert failed:", error.message)
        setOfferError(error.message)
        setSubmittingOffer(false)
        await refreshOfferData()
        return
      }
    }

    setShowOfferForm(false)
    setOfferPrice("")
    setOfferNotes("")
    window.dispatchEvent(new CustomEvent("rhd:offers-changed"))
    await refreshOfferData()
    setSubmittingOffer(false)
  }


  const withdrawOffer = async () => {
    if (!userOffer || submittingOffer) return
    setOfferError(null)
    setSubmittingOffer(true)

    const { error } = await supabase
      .from("offers")
      .delete()
      .eq("id", userOffer.id)

    if (error) {
      console.warn("Withdraw (delete) failed:", error.message)
      setOfferError(error.message)
    } else {
      window.dispatchEvent(new CustomEvent("rhd:offers-changed"))
      await refreshOfferData() // will now come back as null
    }

    setSubmittingOffer(false)
  }

  const statusPill = (status: OfferStatus) => {
  const base =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold border"

  if (status === "accepted") {
    return (
      <span className={`${base} bg-emerald-500/15 border-emerald-400/30 text-emerald-200`}>
        Accepted
      </span>
    )
  }
  if (status === "rejected") {
    return (
      <span className={`${base} bg-zinc-500/15 border-white/10 text-white/70`}>
        Rejected
      </span>
    )
  }

  // With delete-on-withdraw, you’ll basically only see Pending/Accepted/Rejected,
  // but leaving this here is harmless.
  if (status === "withdrawn") {
    return (
      <span className={`${base} bg-zinc-500/15 border-white/10 text-white/70`}>
        Withdrawn
      </span>
    )
  }

  return (
    <span className={`${base} bg-sky-500/15 border-sky-400/30 text-sky-200`}>
      Pending
    </span>
  )
}

  return (
    <div className="max-h-[65vh] overflow-y-auto rounded-2xl bg-zinc-950/95 text-white border border-white/10 shadow-2xl backdrop-blur p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs tracking-wide uppercase text-white/60">Deal Sheet</div>

          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="text-base font-semibold leading-snug break-words">
              {selected.address}
            </div>

            {selected.status === "New" && (
              <div className="shrink-0 text-[11px] px-2 py-1 rounded-full bg-red-600/90 border border-red-400/40 text-white font-semibold shadow-sm">
                New
              </div>
            )}
          </div>

          {/* Hybrid offer signals */}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/70">
            {deadlineLabel && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
                Deadline: <span className="text-white/90">{deadlineLabel}</span>
              </span>
            )}

            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1">
              {offerLoading ? "Offers: …" : `Offers: ${offerCount ?? 0}`}
            </span>

            {userOffer?.status && statusPill(userOffer.status)}
          </div>
        </div>

        <button
          onClick={onClose}
          className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-sm hover:bg-white/5"
        >
          Close
        </button>
      </div>

      {/* Quick stats */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Price</div>
          <div className="mt-1 text-lg font-semibold">{formatMoney(selected.price)}</div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Property</div>
          <div className="mt-1 font-semibold">
            {selected.beds} bd • {selected.baths} ba
          </div>
          <div className="text-sm text-white/70">
            {selected.sqft.toLocaleString()} sqft • {selected.acres} acres
          </div>
        </div>
      </div>

      {/* Investor metrics */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">ARV</div>
          <div className="mt-1 font-semibold">{formatMoney(selected.arv)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Repairs</div>
          <div className="mt-1 font-semibold">{formatMoney(selected.repairs)}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="text-xs text-white/60">Spread</div>
          <div className="mt-1 font-semibold">{formatMoney(spread)}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        <a
          href={selected.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="col-span-1 rounded-xl border border-white/15 py-2 text-center font-semibold hover:bg-white/5"
        >
          Photos
        </a>

        <button
          onClick={() => {
            setOfferError(null)
            setShowOfferForm((v) => !v)
          }}
          disabled={offersClosed || !!userOffer}
          className={`col-span-2 rounded-xl font-semibold py-2 transition ${
            offersClosed || !!userOffer
              ? "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
              : "bg-white text-black hover:opacity-90"
          }`}
          title={
            offersClosed
              ? "Offers are closed"
              : userOffer
              ? "You already submitted an offer"
              : "Submit an offer"
          }
        >
          {offersClosed ? "Offers Closed" : userOffer ? "Offer Submitted" : "Submit Offer"}
        </button>
      </div>

      {/* Offer form (simple v1) */}
      {showOfferForm && !offersClosed && !userOffer && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-semibold">Submit Offer</div>
          <div className="mt-3 grid grid-cols-1 gap-2">
            <label className="text-xs text-white/70">Offer Price</label>
            <input
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              placeholder="$250,000"
              inputMode="decimal"
              className="w-full rounded-xl border border-white/15 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-white/30"
            />

            <label className="mt-2 text-xs text-white/70">Notes (optional)</label>
            <textarea
              value={offerNotes}
              onChange={(e) => setOfferNotes(e.target.value)}
              placeholder="Any quick context (closing flexibility, etc.)"
              rows={3}
              className="w-full rounded-xl border border-white/15 bg-zinc-950/60 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          {offerError && <div className="mt-3 text-xs text-red-300">{offerError}</div>}

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setShowOfferForm(false)}
              className="flex-1 rounded-xl border border-white/15 py-2 text-sm font-semibold hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={submitOffer}
              disabled={submittingOffer}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                submittingOffer
                  ? "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
                  : "bg-white text-black hover:opacity-90"
              }`}
            >
              {submittingOffer ? "Submitting…" : "Submit"}
            </button>
          </div>

          <div className="mt-2 text-[11px] text-white/60">
            Offers are private. You will only see the total offer count.
          </div>
        </div>
      )}

      {/* If user already has an offer, show it simply */}
      {!offerLoading && userOffer && (
        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold">Your Offer</div>
            {statusPill(userOffer.status)}
          </div>
          <div className="mt-2 text-lg font-semibold">{formatMoney(userOffer.offer_price)}</div>
          {userOffer.notes && (
            <div className="mt-1 text-sm text-white/70 whitespace-pre-wrap">{userOffer.notes}</div>
          )}

          {userOffer.status === "pending" && (
            <div className="mt-3">
              <button
                onClick={withdrawOffer}
                disabled={submittingOffer}
                className={`w-full rounded-xl border py-2 text-sm font-semibold transition ${
                  submittingOffer
                    ? "border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                    : "border-white/15 hover:bg-white/5"
                }`}
              >
                {submittingOffer ? "Withdrawing…" : "Withdraw Offer"}
              </button>
              {offerError && <div className="mt-2 text-xs text-red-300">{offerError}</div>}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div className="mt-3">
        <button
          onClick={toggleSave}
          disabled={checking || saving}
          className={`w-full rounded-xl border py-2 font-semibold transition ${
            isSaved
              ? "border-white/25 bg-white/10 hover:bg-white/15"
              : "border-white/15 hover:bg-white/5"
          } ${checking || saving ? "opacity-70 cursor-not-allowed" : ""}`}
        >
          {checking
            ? "Checking…"
            : saving
            ? isSaved
              ? "Unsaving…"
              : "Saving…"
            : isSaved
            ? "Saved"
            : "Save"}
        </button>
      </div>

      <div className="mt-3 text-xs text-white/60">Saved properties are tied to your account.</div>
    </div>
  )
}
