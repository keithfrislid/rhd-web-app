"use client"

import { useEffect, useMemo, useState } from "react"
import type { Property } from "@/lib/properties"
import { effectiveVisibility, formatMoney } from "@/lib/properties"
import { supabase } from "@/lib/supabase"

import { Card, CardContent, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { Input } from "@/components/ui/Input"
import { cn } from "@/lib/cn"
import { StatusBadge } from "@/components/ui/StatusBadge"

type OfferStatus = "pending" | "accepted" | "rejected" | "withdrawn"

function formatCountdown(targetIso: string | null | undefined): string | null {
  if (!targetIso) return null
  const target = new Date(targetIso).getTime()
  if (Number.isNaN(target)) return null
  const diff = target - Date.now()
  if (diff <= 0) return null
  const totalSecs = Math.floor(diff / 1000)
  const d = Math.floor(totalSecs / 86400)
  const h = Math.floor((totalSecs % 86400) / 3600)
  const m = Math.floor((totalSecs % 3600) / 60)
  const s = totalSecs % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

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
  onMarkNew,
}: {
  selected: Property
  onClose: () => void
  isViewed?: boolean
  onMarkNew?: () => void
}) {
  const spread = selected.arv - selected.price - selected.repairs
  const visEff = effectiveVisibility(selected)

  // ---- Saved state (existing feature)
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(true)

  // ---- Offer state (new feature)
  const [offerCount, setOfferCount] = useState<number | null>(null)
  const [userOffer, setUserOffer] = useState<OfferRow | null>(null)
  const [offerLoading, setOfferLoading] = useState(true)

  // ---- Countdown timer for exclusive / VIP windows
  const countdownTarget =
    visEff === "exclusive"
      ? selected.vipReleaseAt
      : visEff === "vip"
      ? selected.publicReleaseAt
      : null

  const [countdown, setCountdown] = useState<string | null>(() =>
    formatCountdown(countdownTarget)
  )

  useEffect(() => {
    setCountdown(formatCountdown(countdownTarget))
    if (!countdownTarget) return
    const id = setInterval(() => {
      const val = formatCountdown(countdownTarget)
      setCountdown(val)
      if (!val) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdownTarget])

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
    <div className="flex flex-col max-h-[65vh] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-xl)] text-[var(--text)]">

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-[var(--border)] bg-[var(--surface-2)] px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Label row */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
                Deal Sheet
              </span>
              {visEff === "exclusive" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/40 bg-purple-500/15 px-2 py-0.5 text-[10px] font-semibold text-purple-400">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="3"/></svg>
                  First Dibs
                </span>
              )}
              {visEff === "vip" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/40 bg-yellow-500/15 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="3"/></svg>
                  VIP Access
                </span>
              )}
              {selected.status === "New" && !isViewed && visEff === "public" && (
                <StatusBadge kind="new" />
              )}
            </div>

            {/* Address */}
            <div className="mt-1.5 text-[15px] font-semibold leading-snug">
              {selected.address}
            </div>

            {/* Countdown */}
            {countdown && (
              <div className={cn(
                "mt-1.5 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium",
                visEff === "exclusive"
                  ? "border-purple-400/25 bg-purple-500/10 text-purple-400"
                  : "border-yellow-400/25 bg-yellow-500/10 text-yellow-400"
              )}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                </svg>
                <span className="text-[var(--muted)]">
                  {visEff === "exclusive" ? "First Dibs ends in" : "VIP Access ends in"}
                </span>
                <span className="tabular-nums font-semibold">{countdown}</span>
              </div>
            )}

            {/* Meta signals */}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {deadlineLabel && (
                <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                  Deadline: <span className="ml-1 font-medium text-[var(--text)]">{deadlineLabel}</span>
                </span>
              )}
              <span className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--muted)]">
                {offerLoading ? "Offers: …" : `${offerCount ?? 0} offer${offerCount === 1 ? "" : "s"}`}
              </span>
              {userOffer?.status === "pending" && <StatusBadge kind="offer_pending" />}
              {userOffer?.status === "accepted" && <StatusBadge kind="offer_accepted" />}
              {userOffer?.status === "rejected" && <StatusBadge kind="offer_rejected" />}
              {isViewed && onMarkNew && (
                <button
                  onClick={onMarkNew}
                  className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
                >
                  Mark New
                </button>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M1 1l10 10M11 1L1 11"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-3">

        {/* Hero price + property facts */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">Asking Price</div>
            <div className="mt-1.5 text-xl font-bold tracking-tight">{formatMoney(selected.price)}</div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">Property</div>
            <div className="mt-1.5 text-sm font-semibold">
              {selected.beds} bd &middot; {selected.baths} ba
            </div>
            <div className="mt-0.5 text-[12px] text-[var(--muted)]">
              {selected.sqft.toLocaleString()} sqft &middot; {selected.acres} ac
            </div>
          </div>
        </div>

        {/* Investor metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">ARV</div>
            <div className="mt-1.5 text-sm font-semibold">{formatMoney(selected.arv)}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">Repairs</div>
            <div className="mt-1.5 text-sm font-semibold">{formatMoney(selected.repairs)}</div>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3">
            <div className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">Spread</div>
            <div className={cn(
              "mt-1.5 text-sm font-bold",
              spread >= 0 ? "text-[var(--success)]" : "text-[var(--danger)]"
            )}>
              {formatMoney(spread)}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          {selected.photoUrl ? (
            <a
              href={selected.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="col-span-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Photos
            </a>
          ) : (
            <div className="col-span-1 inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-2)] py-2.5 text-[12px] text-[var(--muted)] opacity-40 cursor-not-allowed">
              Photos
            </div>
          )}

          <Button
            onClick={() => {
              setOfferError(null)
              setShowOfferForm((v) => !v)
            }}
            disabled={offersClosed || !!userOffer}
            variant={!offersClosed && !userOffer ? "primary" : "secondary"}
            className="col-span-2"
          >
            {offersClosed ? "Offers Closed" : userOffer ? "Offer Submitted" : "Make an Offer"}
          </Button>
        </div>

        {/* Offer form */}
        {showOfferForm && !offersClosed && !userOffer && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="text-[13px] font-semibold">Submit Your Offer</div>
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">Offers are private — only you and the admin can see your offer details.</p>

            <div className="mt-3 space-y-2">
              <div>
                <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">Offer Price</label>
                <Input
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(e.target.value)}
                  placeholder="$250,000"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--muted)] mb-1">Notes <span className="opacity-60">(optional)</span></label>
                <textarea
                  value={offerNotes}
                  onChange={(e) => setOfferNotes(e.target.value)}
                  placeholder="Closing flexibility, financing, etc."
                  rows={3}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--text)] placeholder:text-[var(--muted)] outline-none resize-none focus:border-[var(--accent)]/50 transition-colors"
                />
              </div>
            </div>

            {offerError && (
              <div className="mt-2 text-[11px] text-[var(--danger)]">{offerError}</div>
            )}

            <div className="mt-3 flex gap-2">
              <Button onClick={() => setShowOfferForm(false)} variant="ghost" size="sm" className="flex-1">
                Cancel
              </Button>
              <Button onClick={submitOffer} disabled={submittingOffer} variant="primary" size="sm" className="flex-1">
                {submittingOffer ? "Submitting…" : "Submit Offer"}
              </Button>
            </div>
          </div>
        )}

        {/* User's existing offer */}
        {!offerLoading && userOffer && (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[13px] font-semibold">Your Offer</div>
              {statusBadge && <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>}
            </div>

            <div className="mt-2 text-xl font-bold tracking-tight">{formatMoney(userOffer.offer_price)}</div>

            {userOffer.notes && (
              <div className="mt-1.5 text-[12px] text-[var(--muted)] whitespace-pre-wrap leading-relaxed">
                {userOffer.notes}
              </div>
            )}

            {userOffer.status === "pending" && (
              <>
                <Button
                  onClick={withdrawOffer}
                  disabled={submittingOffer}
                  variant="ghost"
                  size="sm"
                  className="mt-3 w-full text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10"
                >
                  {submittingOffer ? "Withdrawing…" : "Withdraw Offer"}
                </Button>
                {offerError && (
                  <div className="mt-1.5 text-[11px] text-[var(--danger)]">{offerError}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* Save / unsave */}
        <button
          onClick={toggleSave}
          disabled={checking || saving}
          className={cn(
            "w-full flex items-center justify-center gap-2 rounded-xl border py-2.5 text-[13px] font-medium transition-all",
            isSaved
              ? "border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)]",
            (checking || saving) ? "opacity-50 cursor-not-allowed" : ""
          )}
        >
          <svg
            width="14" height="14"
            viewBox="0 0 24 24"
            fill={isSaved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          {checking ? "Checking…" : saving ? (isSaved ? "Unsaving…" : "Saving…") : isSaved ? "Saved" : "Save Property"}
        </button>

      </div>
    </div>
  )
}