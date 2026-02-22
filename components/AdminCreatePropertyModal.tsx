"use client"

import { useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

type PropertyStatus = "New" | "Price Drop" | "Under Contract"

function toNumber(val: string) {
  const n = Number(val)
  return Number.isFinite(n) ? n : NaN
}

export default function AdminCreatePropertyModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

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

  // lat/lng start blank; we fill them from Geoapify
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null)

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
    ]

    // lat/lng can be blank (we’ll auto-geocode on submit), OR valid numbers
    const latOk = lat.trim() === "" || Number.isFinite(toNumber(lat))
    const lngOk = lng.trim() === "" || Number.isFinite(toNumber(lng))

    return nums.every((n) => Number.isFinite(n)) && latOk && lngOk
  }, [address, price, beds, baths, sqft, acres, arv, repairs, lat, lng])

  const reset = () => {
    setErrorMsg(null)
    setAddress("")
    setPhotoUrl("")
    setStatus("New")
    setPrice("")
    setBeds("")
    setBaths("")
    setSqft("")
    setAcres("")
    setArv("")
    setRepairs("")
    setLat("")
    setLng("")
    setGeocodedLabel(null)
  }

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

  const submit = async () => {
    if (saving) return
    setErrorMsg(null)

    if (!canSubmit) {
      setErrorMsg("Please fill all required fields with valid numbers.")
      return
    }

    // If lat/lng are blank, auto-geocode before insert
    if (lat.trim() === "" || lng.trim() === "") {
      await geocodeAddress()
      // if still blank after attempt, stop
      if (lat.trim() === "" || lng.trim() === "") {
        setErrorMsg("Geocode required: could not get coordinates for this address.")
        return
      }
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

    const { error } = await supabase.from("properties").insert(payload)

    if (error) {
      setErrorMsg(error.message)
      setSaving(false)
      return
    }

    setSaving(false)
    reset()
    onClose()
    onCreated()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[5000] flex items-end md:items-center justify-center bg-black/70 backdrop-blur-sm p-3">
      <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/60">Admin</div>
            <div className="text-lg font-semibold">Add Property</div>
          </div>

          <button
            onClick={() => {
              reset()
              onClose()
            }}
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
                  // address changed → clear cached label so you remember to re-geocode
                  setGeocodedLabel(null)
                }}
                placeholder="123 Main St, Nashville, TN"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />

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
            <div className="mt-1 text-[11px] text-white/50">
              If blank, we default to your Google Photos link placeholder.
            </div>
          </div>

          {/* Core numbers */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-white/70">Price *</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="250000" inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>

            <div>
              <label className="text-xs text-white/70">Beds *</label>
              <input value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="3" inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>

            <div>
              <label className="text-xs text-white/70">Baths *</label>
              <input value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="2" inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>

            <div>
              <label className="text-xs text-white/70">Sqft *</label>
              <input value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="1400" inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>

            <div>
              <label className="text-xs text-white/70">Acres *</label>
              <input value={acres} onChange={(e) => setAcres(e.target.value)} placeholder="0.25" inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>

            <div>
              <label className="text-xs text-white/70">ARV *</label>
              <input value={arv} onChange={(e) => setArv(e.target.value)} placeholder="350000" inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>

            <div>
              <label className="text-xs text-white/70">Repairs *</label>
              <input value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="40000" inputMode="numeric"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30" />
            </div>
          </div>

          {/* Lat/Lng (auto-filled, but still visible) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/70">Latitude</label>
              <input
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Auto"
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/30"
              />
            </div>

            <div>
              <label className="text-xs text-white/70">Longitude</label>
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
              onClick={() => {
                reset()
                onClose()
              }}
              className="flex-1 rounded-xl border border-white/15 py-2 text-sm font-semibold hover:bg-white/5"
            >
              Cancel
            </button>

            <button
              disabled={!canSubmit || saving}
              onClick={submit}
              className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                !canSubmit || saving
                  ? "bg-white/10 text-white/60 border border-white/10 cursor-not-allowed"
                  : "bg-white text-black hover:opacity-90"
              }`}
            >
              {saving ? "Creating…" : "Create Property"}
            </button>
          </div>

          <div className="text-[11px] text-white/50">
            Coordinates are cached in Supabase. We only re-geocode if the address changes.
          </div>
        </div>
      </div>
    </div>
  )
}