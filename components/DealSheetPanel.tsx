"use client"

import { useEffect, useState } from "react"
import type { Property } from "@/lib/properties"
import { formatMoney } from "@/lib/properties"
import { supabase } from "@/lib/supabase"

export default function DealSheetPanel({
  selected,
  onClose,
}: {
  selected: Property
  onClose: () => void
}) {
  const spread = selected.arv - selected.price - selected.repairs

  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(true)

  // Check saved state whenever the selected property changes
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      setChecking(true)
      setIsSaved(false)

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser()

      if (cancelled) return

      if (userErr || !user) {
        // If not logged in (shouldn't happen on dashboard), just disable save UX
        setChecking(false)
        return
      }

      const { data, error } = await supabase
        .from("saved_properties")
        .select("id")
        .eq("user_id", user.id)
        .eq("property_id", selected.id)
        .limit(1)

      if (cancelled) return

      if (error) {
        console.warn("Check saved_properties failed:", error.message)
        setIsSaved(false)
        setChecking(false)
        return
      }

      setIsSaved((data?.length ?? 0) > 0)
      setChecking(false)
    }

    run()

    return () => {
      cancelled = true
    }
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
      // Unsave
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
      // Save
      const { error } = await supabase.from("saved_properties").insert({
        user_id: user.id,
        property_id: selected.id,
      })

      if (error) {
        // If user clicks twice quickly, unique constraint can trigger — not a big deal.
        console.warn("Save failed:", error.message)
      } else {
        setIsSaved(true)
        window.dispatchEvent(new CustomEvent("rhd:saves-changed"))
      }
    }

    setSaving(false)
  }

  return (
    <div className="rounded-2xl bg-zinc-950/95 text-white border border-white/10 shadow-2xl backdrop-blur p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs tracking-wide uppercase text-white/60">
            Deal Sheet
          </div>

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
          <div className="mt-1 text-lg font-semibold">
            {formatMoney(selected.price)}
          </div>
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
          <div className="mt-1 font-semibold">
            {formatMoney(selected.repairs)}
          </div>
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
        <button className="col-span-2 rounded-xl bg-white text-black font-semibold py-2 hover:opacity-90">
          Submit Offer
        </button>
      </div>

      <div className="mt-2">
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

      <div className="mt-3 text-xs text-white/60">
        Saved properties are tied to your account.
      </div>
    </div>
  )
}
