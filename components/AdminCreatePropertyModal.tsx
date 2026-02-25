"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

import { ModalShell } from "@/components/ui/ModalShell"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Card } from "@/components/ui/Card"
import { cn } from "@/lib/cn"

type PropertyStatus = "New" | "Price Drop" | "Under Contract"
type Visibility = "public" | "vip" | "exclusive"

type VipBuyer = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  buyer_tier?: "regular" | "vip" | null
  vip_rank?: number | null
}

function toNumber(val: string) {
  const n = Number(val)
  return Number.isFinite(n) ? n : NaN
}

function toIsoFromDateTimeLocal(v: string): string | null {
  // input like "2026-02-25T21:30"
  if (!v?.trim()) return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
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

  // Visibility / first dibs
  const [visibility, setVisibility] = useState<Visibility>("public")
  const [exclusiveUserId, setExclusiveUserId] = useState<string>("")
  const [vipReleaseLocal, setVipReleaseLocal] = useState<string>("")
  const [publicReleaseLocal, setPublicReleaseLocal] = useState<string>("")

  const [vipBuyers, setVipBuyers] = useState<VipBuyer[]>([])
  const [vipLoading, setVipLoading] = useState(false)

  const [price, setPrice] = useState("")
  const [beds, setBeds] = useState("")
  const [baths, setBaths] = useState("")
  const [sqft, setSqft] = useState("")
  const [acres, setAcres] = useState("")
  const [arv, setArv] = useState("")
  const [repairs, setRepairs] = useState("")

  const [county, setCounty] = useState("")
  const [autoNotify, setAutoNotify] = useState(true)

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

    const latOk = lat.trim() === "" || Number.isFinite(toNumber(lat))
    const lngOk = lng.trim() === "" || Number.isFinite(toNumber(lng))

    // If exclusive, require VIP selection
    if (visibility === "exclusive" && !exclusiveUserId.trim()) return false

    return nums.every((n) => Number.isFinite(n)) && latOk && lngOk
  }, [address, price, beds, baths, sqft, acres, arv, repairs, lat, lng, visibility, exclusiveUserId])

  const reset = () => {
    setErrorMsg(null)
    setAddress("")
    setPhotoUrl("")
    setStatus("New")

    setVisibility("public")
    setExclusiveUserId("")
    setVipReleaseLocal("")
    setPublicReleaseLocal("")

    setPrice("")
    setBeds("")
    setBaths("")
    setSqft("")
    setAcres("")
    setArv("")
    setRepairs("")
    setCounty("")
    setAutoNotify(true)
    setLat("")
    setLng("")
    setGeocodedLabel(null)
  }

  const loadVipBuyers = async () => {
    setVipLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users/buyers`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)

      const buyers = (json?.buyers ?? []) as VipBuyer[]
      const vips = buyers
        .filter((b) => (b.buyer_tier ?? "regular") === "vip")
        .sort((a, b) => (Number(b.vip_rank ?? 0) || 0) - (Number(a.vip_rank ?? 0) || 0))

      setVipBuyers(vips)
    } catch (e) {
      setVipBuyers([])
    } finally {
      setVipLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    loadVipBuyers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

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

      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/geocode`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })

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

  const applyPreset = (preset: "public_now" | "vip_now_public_24h" | "exclusive_now_vip_6h_public_24h") => {
    const now = new Date()
    const toLocal = (d: Date) => {
      const pad = (n: number) => String(n).padStart(2, "0")
      const yyyy = d.getFullYear()
      const mm = pad(d.getMonth() + 1)
      const dd = pad(d.getDate())
      const hh = pad(d.getHours())
      const mi = pad(d.getMinutes())
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
    }

    if (preset === "public_now") {
      setVisibility("public")
      setVipReleaseLocal("")
      setPublicReleaseLocal("")
      return
    }

    if (preset === "vip_now_public_24h") {
      setVisibility("vip")
      setVipReleaseLocal("") // VIP now
      const pub = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      setPublicReleaseLocal(toLocal(pub))
      return
    }

    setVisibility("exclusive")
    const vip = new Date(now.getTime() + 6 * 60 * 60 * 1000)
    const pub = new Date(now.getTime() + 24 * 60 * 60 * 1000)
    setVipReleaseLocal(toLocal(vip))
    setPublicReleaseLocal(toLocal(pub))
  }

  const submit = async () => {
    if (saving) return
    setErrorMsg(null)

    if (!canSubmit) {
      setErrorMsg("Please fill all required fields (and pick an exclusive VIP if needed).")
      return
    }

    if (lat.trim() === "" || lng.trim() === "") {
      await geocodeAddress()
      if (lat.trim() === "" || lng.trim() === "") {
        setErrorMsg("Geocode required: could not get coordinates for this address.")
        return
      }
    }

    setSaving(true)

    const payload: any = {
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

      county: county.trim() || null,
      auto_notify: autoNotify,

      visibility,
      vip_release_at: toIsoFromDateTimeLocal(vipReleaseLocal),
      public_release_at: toIsoFromDateTimeLocal(publicReleaseLocal),
      exclusive_user_id: visibility === "exclusive" ? exclusiveUserId : null,
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
    <div className="fixed inset-0 z-[5000] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center">
      <ModalShell
        title="Add Property"
        description="Create a new deal and control its release visibility."
        right={
          <Button
            variant="ghost"
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Close
          </Button>
        }
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                reset()
                onClose()
              }}
            >
              Cancel
            </Button>

            <Button variant="primary" onClick={submit} disabled={!canSubmit || saving}>
              {saving ? "Saving…" : "Create Property"}
            </Button>
          </div>
        }
        className="overflow-hidden"
      >
        <div className="max-h-[80vh] space-y-4 overflow-y-auto p-5">
          {errorMsg && (
            <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--text)]">
              {errorMsg}
            </div>
          )}

          {/* Address + Status + County */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <div className="flex items-end justify-between gap-2">
                <label className="text-xs text-[var(--muted)]">Address *</label>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={geocodeAddress}
                  disabled={geocoding || !address.trim()}
                  title="Fetch coordinates"
                >
                  {geocoding ? "Geocoding…" : "Geocode"}
                </Button>
              </div>

              <Input
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value)
                  setGeocodedLabel(null)
                }}
                placeholder="123 Main St, Nashville, TN"
                className="mt-1"
              />

              {geocodedLabel && (
                <div className="mt-1 text-[11px] text-[var(--success)]/90">Geocoded: {geocodedLabel}</div>
              )}
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">Status</label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as PropertyStatus)}
                className="mt-1"
              >
                <option value="New">New</option>
                <option value="Price Drop">Price Drop</option>
                <option value="Under Contract">Under Contract</option>
              </Select>
            </div>

            <Card className="p-3 md:col-span-3">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="md:col-span-2">
                  <label className="text-xs text-[var(--muted)]">County</label>
                  <Input
                    value={county}
                    onChange={(e) => setCounty(e.target.value)}
                    placeholder="e.g. Knox"
                    className="mt-1"
                  />
                </div>

                <div className="flex items-end">
                  <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input
                      type="checkbox"
                      checked={autoNotify}
                      onChange={(e) => setAutoNotify(e.target.checked)}
                      className={cn(
                        "h-4 w-4 rounded border border-[var(--border)] bg-[var(--surface)]",
                        "accent-[var(--accent)]"
                      )}
                    />
                    Auto notify buyers when released
                  </label>
                </div>
              </div>
            </Card>
          </div>

          {/* First Dibs / Visibility */}
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-[var(--text)]">First Dibs / Visibility</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">Control who can see the deal and when.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset("public_now")}>
                  Public now
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset("vip_now_public_24h")}
                >
                  VIP now → Public 24h
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => applyPreset("exclusive_now_vip_6h_public_24h")}
                >
                  Exclusive → VIP 6h → Public 24h
                </Button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div>
                <label className="text-xs text-[var(--muted)]">Visibility</label>
                <Select
                  value={visibility}
                  onChange={(e) => {
                    const v = e.target.value as Visibility
                    setVisibility(v)
                    if (v !== "exclusive") setExclusiveUserId("")
                  }}
                  className="mt-1"
                >
                  <option value="public">Public</option>
                  <option value="vip">VIP</option>
                  <option value="exclusive">Exclusive VIP</option>
                </Select>
              </div>

              <div>
                <label className="text-xs text-[var(--muted)]">VIP release (optional)</label>
                <Input
                  type="datetime-local"
                  value={vipReleaseLocal}
                  onChange={(e) => setVipReleaseLocal(e.target.value)}
                  className="mt-1"
                />
                <div className="mt-1 text-[11px] text-[var(--muted)]">Blank = VIP can see now.</div>
              </div>

              <div>
                <label className="text-xs text-[var(--muted)]">Public release (optional)</label>
                <Input
                  type="datetime-local"
                  value={publicReleaseLocal}
                  onChange={(e) => setPublicReleaseLocal(e.target.value)}
                  className="mt-1"
                />
                <div className="mt-1 text-[11px] text-[var(--muted)]">Blank = Public can see now.</div>
              </div>
            </div>

            {visibility === "exclusive" && (
              <div className="mt-3">
                <label className="text-xs text-[var(--muted)]">Exclusive VIP (required)</label>
                <Select
                  value={exclusiveUserId}
                  onChange={(e) => setExclusiveUserId(e.target.value)}
                  disabled={vipLoading}
                  className="mt-1"
                >
                  <option value="">{vipLoading ? "Loading VIPs…" : "Select a VIP buyer…"}</option>
                  {vipBuyers.map((b) => {
                    const name = `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() || b.email || b.user_id
                    const rank = Number(b.vip_rank ?? 0) || 0
                    return (
                      <option key={b.user_id} value={b.user_id}>
                        {name} {rank ? `(rank ${rank})` : ""}
                      </option>
                    )
                  })}
                </Select>

                <div className="mt-1 text-[11px] text-[var(--muted)]">
                  If no VIPs appear, set someone to VIP in Buyer Rankings first.
                </div>
              </div>
            )}
          </Card>

          {/* Photo URL */}
          <div>
            <label className="text-xs text-[var(--muted)]">Photo URL (optional)</label>
            <Input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://photos.google.com/..."
              className="mt-1"
            />
          </div>

          {/* Numbers */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div>
              <label className="text-xs text-[var(--muted)]">Price *</label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Beds *</label>
              <Input value={beds} onChange={(e) => setBeds(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Baths *</label>
              <Input value={baths} onChange={(e) => setBaths(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Sqft *</label>
              <Input value={sqft} onChange={(e) => setSqft(e.target.value)} className="mt-1" />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">Acres *</label>
              <Input value={acres} onChange={(e) => setAcres(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">ARV *</label>
              <Input value={arv} onChange={(e) => setArv(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-[var(--muted)]">Repairs *</label>
              <Input value={repairs} onChange={(e) => setRepairs(e.target.value)} className="mt-1" />
            </div>

            <div>
              <label className="text-xs text-[var(--muted)]">Lat / Lng</label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="lat" />
                <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="lng" />
              </div>
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  )
}