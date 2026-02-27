"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"
import type { PropertyStatus } from "@/lib/properties"

import { ModalShell } from "@/components/ui/ModalShell"
import { Card, CardContent, CardHeader } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"

type Visibility = "public" | "vip" | "exclusive"

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

function isoToDateTimeLocal(iso: string | null | undefined): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = d.getFullYear()
  const mm = pad(d.getMonth() + 1)
  const dd = pad(d.getDate())
  const hh = pad(d.getHours())
  const mi = pad(d.getMinutes())
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

type VipBuyer = {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  buyer_tier?: "regular" | "vip" | null
  vip_rank?: number | null
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

  // Phase 9B fields
  visibility?: Visibility
  exclusive_user_id?: string | null
  vip_release_at?: string | null
  public_release_at?: string | null
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

  // First dibs / visibility
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

  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [geocodedLabel, setGeocodedLabel] = useState<string | null>(null)

  // original values (for “only re-geocode when address changes”)
  const [originalAddress, setOriginalAddress] = useState("")
  const [originalLat, setOriginalLat] = useState("")
  const [originalLng, setOriginalLng] = useState("")

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
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      )

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`)

      const buyers = (json?.buyers ?? []) as VipBuyer[]
      const vips = buyers
        .filter((b) => (b.buyer_tier ?? "regular") === "vip")
        .sort((a, b) => (Number(b.vip_rank ?? 0) || 0) - (Number(a.vip_rank ?? 0) || 0))

      setVipBuyers(vips)
    } catch {
      setVipBuyers([])
    } finally {
      setVipLoading(false)
    }
  }

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

    // visibility fields
    setVisibility((property.visibility as Visibility) ?? "public")
    setExclusiveUserId(property.exclusive_user_id ?? "")
    setVipReleaseLocal(isoToDateTimeLocal(property.vip_release_at ?? null))
    setPublicReleaseLocal(isoToDateTimeLocal(property.public_release_at ?? null))

    setGeocodedLabel(null)

    setOriginalAddress(property.address ?? "")
    setOriginalLat(String(property.lat ?? ""))
    setOriginalLng(String(property.lng ?? ""))

    loadVipBuyers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id])

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

    if (!nums.every((n) => Number.isFinite(n))) return false
    if (visibility === "exclusive" && !exclusiveUserId.trim()) return false

    return true
  }, [
    address,
    price,
    beds,
    baths,
    sqft,
    acres,
    arv,
    repairs,
    lat,
    lng,
    visibility,
    exclusiveUserId,
  ])

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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
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

  const applyPreset = (
    preset: "public_now" | "vip_now_public_24h" | "exclusive_now_vip_6h_public_24h"
  ) => {
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
      setExclusiveUserId("")
      setVipReleaseLocal("")
      setPublicReleaseLocal("")
      return
    }

    if (preset === "vip_now_public_24h") {
      setVisibility("vip")
      setExclusiveUserId("")
      setVipReleaseLocal("")
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
      setErrorMsg("Please fill all required fields (and pick an exclusive VIP if needed).")
      return
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

      visibility,
      vip_release_at: toIsoFromDateTimeLocal(vipReleaseLocal),
      public_release_at: toIsoFromDateTimeLocal(publicReleaseLocal),
      exclusive_user_id: visibility === "exclusive" ? exclusiveUserId : null,
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
    <div className="fixed inset-0 z-[7000] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center">
      <ModalShell
        title="Edit Property"
        description="Admin"
        right={
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        }
        className="flex max-h-[90vh] flex-col overflow-hidden"
        footer={
          <div className="flex gap-2">
            <Button onClick={onClose} variant="secondary" className="flex-1">
              Cancel
            </Button>
            <Button
              disabled={!canSubmit || saving}
              onClick={save}
              variant="primary"
              className={cn("flex-1", !canSubmit || saving ? "opacity-70" : "")}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {errorMsg && (
            <div className="rounded-2xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--danger)]">
              {errorMsg}
            </div>
          )}

          {/* Address + Status */}
          <Card>
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div className="text-sm font-semibold">Basics</div>
                <div className="flex items-center gap-2">
                  {addressChanged ? (
                    <Badge variant="warning">Re-geocode required</Badge>
                  ) : (
                    <Badge variant="muted">Using cached coords</Badge>
                  )}
                  <Button
                    onClick={geocodeAddress}
                    disabled={geocoding || !address.trim()}
                    size="sm"
                    variant="secondary"
                    title="Fetch coordinates from Geoapify"
                  >
                    {geocoding ? "Geocoding…" : "Geocode"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-[var(--muted)]">Address *</label>
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
                  <div className="mt-1 text-[11px] text-[var(--success)]">
                    Geocoded: {geocodedLabel}
                  </div>
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

              <div className="md:col-span-3">
                <label className="text-xs text-[var(--muted)]">Photo URL (optional)</label>
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://photos.google.com/..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* First Dibs / Visibility */}
          <Card>
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">First Dibs / Visibility</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    Control who can see the deal and when.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyPreset("public_now")}
                  >
                    Public now
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyPreset("vip_now_public_24h")}
                  >
                    VIP now → Public 24h
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => applyPreset("exclusive_now_vip_6h_public_24h")}
                  >
                    Exclusive → VIP 6h → Public 24h
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                <div className="mt-1 text-[11px] text-[var(--muted)]">
                  Blank = Public can see now.
                </div>
              </div>

              {visibility === "exclusive" && (
                <div className="md:col-span-3">
                  <label className="text-xs text-[var(--muted)]">Exclusive VIP (required)</label>
                  <Select
                    value={exclusiveUserId}
                    onChange={(e) => setExclusiveUserId(e.target.value)}
                    disabled={vipLoading}
                    className="mt-1"
                  >
                    <option value="">{vipLoading ? "Loading VIPs…" : "Select a VIP buyer…"}</option>
                    {vipBuyers.map((b) => {
                      const name =
                        `${b.first_name ?? ""} ${b.last_name ?? ""}`.trim() ||
                        b.email ||
                        b.user_id
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
            </CardContent>
          </Card>

          {/* Core numbers */}
          <Card>
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div className="text-sm font-semibold">Numbers</div>
            </CardHeader>

            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="Price *">
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="250000"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Beds *">
                <Input
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="3"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Baths *">
                <Input
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  placeholder="2"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Sqft *">
                <Input
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="1400"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Acres *">
                <Input
                  value={acres}
                  onChange={(e) => setAcres(e.target.value)}
                  placeholder="0.25"
                  inputMode="decimal"
                />
              </Field>

              <Field label="ARV *">
                <Input
                  value={arv}
                  onChange={(e) => setArv(e.target.value)}
                  placeholder="350000"
                  inputMode="numeric"
                />
              </Field>

              <Field label="Repairs *">
                <Input
                  value={repairs}
                  onChange={(e) => setRepairs(e.target.value)}
                  placeholder="40000"
                  inputMode="numeric"
                />
              </Field>
            </CardContent>
          </Card>

          {/* Lat/Lng */}
          <Card>
            <CardHeader className="border-b border-[var(--border)] bg-[var(--surface-2)]">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">Coordinates</div>
                <Badge variant="muted" className="text-[11px]">
                  We keep cached coordinates unless the address changes.
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="grid grid-cols-2 gap-3">
              <Field label="Latitude *">
                <Input
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="Auto"
                  inputMode="decimal"
                />
              </Field>

              <Field label="Longitude *">
                <Input
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  placeholder="Auto"
                  inputMode="decimal"
                />
              </Field>
            </CardContent>
          </Card>

        </div>
      </ModalShell>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs text-[var(--muted)]">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}