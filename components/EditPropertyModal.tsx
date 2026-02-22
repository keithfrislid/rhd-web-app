"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { PropertyStatus } from "@/lib/properties"

function toNumber(val: string) {
  const n = Number(val)
  return Number.isFinite(n) ? n : NaN
}

type PropertyRowForEdit = {
  id: string
  address: string
  photo_url: string | null
  status: PropertyStatus
  price: number
  beds: number
  baths: number
  sqft: number
  acres: number
  arv: number
  repairs: number
  lat: number
  lng: number
}

export default function EditPropertyModal({
  property,
  onClose,
  onSaved,
}: {
  property: PropertyRowForEdit
  onClose: () => void
  onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // editable fields
  const [address, setAddress] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [status, setStatus] = useState<PropertyStatus>("New")

  const [price, setPrice] = useState("")
  const [beds, setBeds] = useState("")
  const [baths, setBaths] = useState("")
  const [sqft, setSqft] = useState("")
  const [acres, setAcres] = useState("")
  const [arv, setArv] = useState("")
  const [repairs, setRepairs] = useState("")

  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null)

  // original values (for “only re-geocode when address changes”)
  const [originalAddress, setOriginalAddress] = useState("")
  const [originalLat, setOriginalLat] = useState("")
  const [originalLng, setOriginalLng] = useState("")

  useEffect(() => {
    // prefill everything from the selected row
    setErrorMsg(null)

    setAddress(property.address ?? "")
    setPhotoUrl(property.photo_url ?? "https://photos.google.com/")
    setStatus(property.status ?? "New")

    setPrice(String(property.price ?? ""))
    setBeds(String(property.beds ?? ""))
    setBaths(String(property.baths ?? ""))
    setSqft(String(property.sqft ?? ""))
    setAcres(String(property.acres ?? ""))
    setArv(String(property.arv ?? ""))
    setRepairs(String(property.repairs ?? ""))

    setLat(String(property.lat ?? ""))
    setLng(String(property.lng ?? ""))

    setGeocodedLabel(null)

    setOriginalAddress(property.address ?? "")
    setOriginalLat(String(property.lat ?? ""))
    setOriginalLng(String(property.lng ?? ""))
  }, [property])

  const addressChanged = useMemo(() => {
    return address.trim() !== originalAddress.trim()
  }, [address, originalAddress])

  const canSubmit = useMemo(() => {
    if (!address.trim()) return false

    const nums = [
      toNumber(price),
      toNumber(beds),
      toNumber(baths),
      toNumber(sqft),
      toNumber(acres),
      toNumber(arv),
      toNumber(repairs),
      toNumber(lat),
      toNumber(lng),
    ]

    return nums.every((n) => Number.isFinite(n))
  }, [address, price, beds, baths, sqft, acres, arv, repairs, lat, lng])

  const geocodeAddress = async () => {
    if (geocoding) return
    setErrorMsg(null)

    const text = address.trim()
    if (!text) {
      setErrorMsg("Enter an address first, then click Geocode.")
      return
    }

    setGeocoding(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/geocode`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text }),
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Geocode failed (${res.status})`)

      setLat(String(json.lat))
      setLng(String(json.lng))
      setGeocodedLabel(json.formatted ?? null)
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Geocoding failed.")
    } finally {
      setGeocoding(false)
    }
  }

  const save = async () => {
    if (saving) return
    setErrorMsg(null)

    // Enforce: only re-call when address changes; otherwise keep cached coords.
    // If address changed BUT lat/lng are still the original values, block save.
    if (addressChanged && lat.trim() === originalLat.trim() && lng.trim() === originalLng.trim()) {
      setErrorMsg("Address changed — click Geocode (or manually update lat/lng) before saving.")
      return
    }

    if (!canSubmit) {
      setErrorMsg("Please fill all required fields with valid numbers.")
      return
    }

    setSaving(true)

    const payload = {
      address: address.trim(),
      photo_url: photoUrl.trim() ? photoUrl.trim() : "https://photos.google.com/",
      status,
      price: toNumber(price),
      beds: toNumber(beds),
      baths: toNumber(baths),
      sqft: toNumber(sqft),
      acres: toNumber(acres),
      arv: toNumber(arv),
      repairs: toNumber(repairs),
      lat: toNumber(lat),
      lng: toNumber(lng),
    }

    const { error } = await supabase.from("properties").update(payload).eq("id", property.id)

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    onClose()
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-[5000] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-3">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/60">Admin</div>
            <div className="text-lg font-semibold">Edit Property</div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Address + Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <div className="flex items-end justify-between gap-2">
                <label className="text-xs text-white/70">Address *</label>

                <button
                  onClick={geocodeAddress}
                  disabled={geocoding || !address.trim()}
                  className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                    geocoding || !address.trim()
                      ? "border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                      : "border-white/20 bg-white/10 text-white hover:bg-white/15"
                  }`}
                  title="Fetch coordinates from Geoapify"
                >
                  {geocoding ? "Geocoding…" : "Geocode"}
                </button>
              </div>

              <input
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  setGeocodedLabel(null)
                  // If address changed, do NOT auto-geocode; we enforce on save
                }}
                placeholder="123 Main St, Nashville, TN"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />

              {addressChanged ? (
                <div className="mt-1 text-[11px] text-amber-200/80">
                  Address changed — re-geocode required before saving.
                </div>
              ) : (
                <div className="mt-1 text-[11px] text-white/50">
                  Address unchanged — cached lat/lng will be kept.
                </div>
              )}

              {geocodedLabel && (
                <div className="mt-1 text-[11px] text-emerald-200/80">
                  Geocoded: {geocodedLabel}
                </div>
              )}
            </div>

            <div>
              <label className="text-xs text-white/70">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              >
                <option value="New">New</option>
                <option value="Price Drop">Price Drop</option>
                <option value="Under Contract">Under Contract</option>
              </select>
            </div>
          </div>

          {/* Photo URL */}
          <div>
            <label className="text-xs text-white/70">Photo URL (optional)</label>
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://photos.google.com/..."
              className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
            />
          </div>

          {/* Core numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-white/70">Price *</label>
              <input
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="250000"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Beds *</label>
              <input
                value={beds}
                onChange={(e) => setBeds(e.target.value)}
                placeholder="3"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Baths *</label>
              <input
                value={baths}
                onChange={(e) => setBaths(e.target.value)}
                placeholder="2"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Sqft *</label>
              <input
                value={sqft}
                onChange={(e) => setSqft(e.target.value)}
                placeholder="1400"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Acres *</label>
              <input
                value={acres}
                onChange={(e) => setAcres(e.target.value)}
                placeholder="0.25"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">ARV *</label>
              <input
                value={arv}
                onChange={(e) => setArv(e.target.value)}
                placeholder="350000"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Repairs *</label>
              <input
                value={repairs}
                onChange={(e) => setRepairs(e.target.value)}
                placeholder="40000"
                inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
          </div>

          {/* Lat/Lng */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/70">Latitude *</label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Auto"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Longitude *</label>
              <input
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="Auto"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/15 py-2 text-sm font-semibold hover:bg-white/5"
            >
              Cancel
            </button>

            <button
              disabled={!canSubmit || saving}
              onClick={save}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                !canSubmit || saving
                  ? "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
                  : "bg-white text-black hover:opacity-90"
              }`}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>

          <div className="text-[11px] text-white/50">
            We keep cached coordinates unless the address changes.
          </div>
        </div>
      </div>
    </div>
  )
}