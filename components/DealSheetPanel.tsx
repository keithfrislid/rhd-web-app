"use client"

import { useEffect, useMemo, useState } from "react"
import type { Property } from "@/lib/properties"
import { formatMoney } from "@/lib/properties"
import { supabase } from "@/lib/supabase"

import { Card, CardContent, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/cn"
import { StatusBadge } from "@/components/ui/StatusBadge"

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

function statusToBadgeVariant(status: OfferStatus) {
  if (status === "accepted") return { variant: "success" as const, label: "Accepted" }
  if (status === "rejected") return { variant: "muted" as const, label: "Rejected" }
  if (status === "withdrawn") return { variant: "muted" as const, label: "Withdrawn" }
  return { variant: "accent" as const, label: "Pending" }
}

export default function DealSheetPanel({
  selected,
  onClose,
  isViewed = false,
}: {
  selected: Property
  onClose: () => void
  isViewed?: boolean
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
    () => formatDeadline((selected as any).offerDeadline),
    // keep the same behavior even if type is loose
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [(selected as any).offerDeadline]
  )

  const offersClosed = useMemo(() => {
    if ((selected as any).isAcceptingOffers === false) return true
    if ((selected as any).acceptedOfferId) return true
    if (!(selected as any).offerDeadline) return false
    const d = new Date((selected as any).offerDeadline)
    if (Number.isNaN(d.getTime())) return false
    return Date.now() > d.getTime()
  }, [selected])

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

    const { error } = await supabase.from("offers").delete().eq("id", userOffer.id)

    if (error) {
      console.warn("Withdraw (delete) failed:", error.message)
      setOfferError(error.message)
    } else {
      window.dispatchEvent(new CustomEvent("rhd:offers-changed"))
      await refreshOfferData()
    }

    setSubmittingOffer(false)
  }

  const statusBadge = userOffer?.status ? statusToBadgeVariant(userOffer.status) : null

  return (
    <Card className="max-h-[65vh] overflow-y-auto bg-[var(--surface)]/95 text-[var(--text)] border border-[var(--border)] shadow-2xl backdrop-blur rounded-2xl">
      <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs tracking-wide uppercase text-[var(--muted)]">
              Deal Sheet
            </div>

            <div className="mt-1 flex items-start justify-between gap-2">
              <div className="text-base font-semibold leading-snug break-words">
                {selected.address}
              </div>

              {selected.status === "New" && !isViewed && <StatusBadge kind="new" className="shrink-0" />}
            </div>

            {/* Hybrid offer signals */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              {deadlineLabel && (
                <Badge variant="outline" className="text-[11px] font-semibold">
                  Deadline: <span className="ml-1 text-[var(--text)]">{deadlineLabel}</span>
                </Badge>
              )}

              <Badge variant="outline" className="text-[11px] font-semibold">
                {offerLoading ? "Offers: …" : `Offers: ${offerCount ?? 0}`}
              </Badge>

              {userOffer?.status === "pending" && <StatusBadge kind="offer_pending" />}
              {userOffer?.status === "accepted" && <StatusBadge kind="offer_accepted" />}
              {userOffer?.status === "rejected" && <StatusBadge kind="offer_rejected" />}
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-xs text-[var(--muted)]">Price</div>
            <div className="mt-1 text-lg font-semibold">{formatMoney(selected.price)}</div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-xs text-[var(--muted)]">Property</div>
            <div className="mt-1 font-semibold">
              {selected.beds} bd • {selected.baths} ba
            </div>
            <div className="text-sm text-[var(--muted)]">
              {selected.sqft.toLocaleString()} sqft • {selected.acres} acres
            </div>
          </div>
        </div>

        {/* Investor metrics */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-xs text-[var(--muted)]">ARV</div>
            <div className="mt-1 font-semibold">{formatMoney(selected.arv)}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-xs text-[var(--muted)]">Repairs</div>
            <div className="mt-1 font-semibold">{formatMoney(selected.repairs)}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-xs text-[var(--muted)]">Spread</div>
            <div className="mt-1 font-semibold">{formatMoney(spread)}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <a
            href={(selected as any).photoUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "col-span-1 inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2 text-sm font-semibold",
              "hover:bg-[var(--surface)]"
            )}
          >
            Photos
          </a>

          <Button
            onClick={() => {
              setOfferError(null)
              setShowOfferForm((v) => !v)
            }}
            disabled={offersClosed || !!userOffer}
            variant={offersClosed || !!userOffer ? "secondary" : "primary"}
            className={cn("col-span-2", offersClosed || !!userOffer ? "opacity-70" : "")}
            title={
              offersClosed
                ? "Offers are closed"
                : userOffer
                ? "You already submitted an offer"
                : "Submit an offer"
            }
          >
            {offersClosed ? "Offers Closed" : userOffer ? "Offer Submitted" : "Submit Offer"}
          </Button>
        </div>

        {/* Offer form (simple v1) */}
        {showOfferForm && !offersClosed && !userOffer && (
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="text-sm font-semibold">Submit Offer</div>

            <div className="mt-3 grid grid-cols-1 gap-2">
              <label className="text-xs text-[var(--muted)]">Offer Price</label>
              <Input
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder="$250,000"
                inputMode="decimal"
                className="h-10"
              />

              <label className="mt-2 text-xs text-[var(--muted)]">Notes (optional)</label>
              <textarea
                value={offerNotes}
                onChange={(e) => setOfferNotes(e.target.value)}
                placeholder="Any quick context (closing flexibility, etc.)"
                rows={3}
                className={cn(
                  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none",
                  "focus:border-white/30"
                )}
              />
            </div>

            {offerError && <div className="mt-3 text-xs text-[var(--danger)]">{offerError}</div>}

            <div className="mt-3 flex gap-2">
              <Button
                onClick={() => setShowOfferForm(false)}
                variant="secondary"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={submitOffer}
                disabled={submittingOffer}
                variant="primary"
                className={cn("flex-1", submittingOffer ? "opacity-70" : "")}
              >
                {submittingOffer ? "Submitting…" : "Submit"}
              </Button>
            </div>

            <div className="mt-2 text-[11px] text-[var(--muted)]">
              Offers are private. You will only see the total offer count.
            </div>
          </div>
        )}

        {/* If user already has an offer, show it simply */}
        {!offerLoading && userOffer && (
          <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold">Your Offer</div>
              {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
            </div>

            <div className="mt-2 text-lg font-semibold">{formatMoney(userOffer.offer_price)}</div>

            {userOffer.notes && (
              <div className="mt-1 text-sm text-[var(--muted)] whitespace-pre-wrap">
                {userOffer.notes}
              </div>
            )}

            {userOffer.status === "pending" && (
              <div className="mt-3">
                <Button
                  onClick={withdrawOffer}
                  disabled={submittingOffer}
                  variant="secondary"
                  className={cn("w-full", submittingOffer ? "opacity-70" : "")}
                >
                  {submittingOffer ? "Withdrawing…" : "Withdraw Offer"}
                </Button>

                {offerError && (
                  <div className="mt-2 text-xs text-[var(--danger)]">{offerError}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Save button */}
        <div className="mt-3">
          <Button
            onClick={toggleSave}
            disabled={checking || saving}
            variant={isSaved ? "secondary" : "secondary"}
            className={cn("w-full", checking || saving ? "opacity-70" : "")}
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
          </Button>
        </div>

        <div className="mt-3 text-xs text-[var(--muted)]">
          Saved properties are tied to your account.
        </div>
      </CardContent>
    </Card>
  )
}