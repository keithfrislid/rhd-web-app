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

function hoursFromNowIso(hours: string): string | null {
  const h = parseFloat(hours)
  if (!Number.isFinite(h) || h <= 0) return null
  return new Date(Date.now() + h * 60 * 60 * 1000).toISOString()
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
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [address, setAddress] = useState("")
  const [photoUrl, setPhotoUrl] = useState("")
  const [status, setStatus] = useState<PropertyStatus>("New")

  const [visibility, setVisibility] = useState<Visibility>("public")
  const [exclusiveUserId, setExclusiveUserId] = useState<string>("")
  const [vipHours, setVipHours] = useState<string>("")
  const [publicHours, setPublicHours] = useState<string>("")

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

  // Step 1 is valid when all property fields are filled
  const canNext = useMemo(() => {
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
    return nums.every((n) => Number.isFinite(n)) && latOk && lngOk
  }, [address, price, beds, baths, sqft, acres, arv, repairs, lat, lng])

  // Step 2 is valid when exclusive VIP is selected if required
  const canSubmit = useMemo(() => {
    if (visibility === "exclusive" && !exclusiveUserId.trim()) return false
    return true
  }, [visibility, exclusiveUserId])

  const reset = () => {
    setStep(1)
    setErrorMsg(null)
    setAddress("")
    setPhotoUrl("")
    setStatus("New")
    setVisibility("public")
    setExclusiveUserId("")
    setVipHours("")
    setPublicHours("")
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
    } catch {
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
      if (json.county && !county.trim()) {
        setCounty(json.county)
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Geocoding failed.")
    } finally {
      setGeocoding(false)
    }
  }

  const applyPreset = (preset: "public_now" | "vip_now_public_24h" | "exclusive_now_vip_6h_public_24h") => {
    if (preset === "public_now") {
      setVisibility("public")
      setVipHours("")
      setPublicHours("")
      return
    }
    if (preset === "vip_now_public_24h") {
      setVisibility("vip")
      setVipHours("")
      setPublicHours("24")
      return
    }
    setVisibility("exclusive")
    setVipHours("6")
    setPublicHours("24")
  }

  const goToStep2 = () => {
    setErrorMsg(null)
    setStep(2)
  }

  const submit = async () => {
    if (saving) return
    setErrorMsg(null)

    if (lat.trim() === "" || lng.trim() === "") {
      await geocodeAddress()
      if (lat.trim() === "" || lng.trim() === "") {
        setErrorMsg("Geocode required: could not get coordinates for this address.")
        return
      }
    }

    setSaving(true)

    const { error } = await supabase.from("properties").insert({
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
      vip_release_at: hoursFromNowIso(vipHours),
      public_release_at: hoursFromNowIso(publicHours),
      exclusive_user_id: visibility === "exclusive" ? exclusiveUserId : null,
    })

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
    <div className="fixed inset-0 z-[7000] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center">
      <ModalShell
        title="Add Property"
        description={step === 1 ? "Step 1 of 2 · Property Details" : "Step 2 of 2 · First Dibs / Visibility"}
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
          step === 1 ? (
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
              <Button variant="primary" onClick={goToStep2} disabled={!canNext}>
                Next →
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" onClick={() => { setErrorMsg(null); setStep(1) }}>
                ← Back
              </Button>
              <Button variant="primary" onClick={submit} disabled={!canSubmit || saving}>
                {saving ? "Saving…" : "Create Property"}
              </Button>
            </div>
          )
        }
        className="flex max-h-[90vh] flex-col overflow-hidden"
      >
        {errorMsg && (
          <div className="mb-4 rounded-xl border border-[var(--danger)]/30 bg-[var(--danger)]/10 p-3 text-sm text-[var(--text)]">
            {errorMsg}
          </div>
        )}

        {/* ── Step 1: Property Details ── */}
        {step === 1 && (
          <div className="space-y-4">
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
                  >
                    {geocoding ? "Geocoding…" : "Geocode"}
                  </Button>
                </div>
                <Input
                  value={address}
                  onChange={(e) => { setAddress(e.target.value); setGeocodedLabel(null) }}
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
                <Input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="150000" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Beds *</label>
                <Input value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="3" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Baths *</label>
                <Input value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="2" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Sqft *</label>
                <Input value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="1400" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Acres *</label>
                <Input value={acres} onChange={(e) => setAcres(e.target.value)} placeholder="0.25" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">ARV *</label>
                <Input value={arv} onChange={(e) => setArv(e.target.value)} placeholder="225000" className="mt-1" />
              </div>
              <div>
                <label className="text-xs text-[var(--muted)]">Repairs *</label>
                <Input value={repairs} onChange={(e) => setRepairs(e.target.value)} placeholder="30000" className="mt-1" />
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
        )}

        {/* ── Step 2: First Dibs / Visibility ── */}
        {step === 2 && (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-[var(--text)]">First Dibs / Visibility</div>
                  <div className="mt-0.5 text-xs text-[var(--muted)]">
                    Control who can see this deal and when it becomes available.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset("public_now")}>
                    Public now
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset("vip_now_public_24h")}>
                    VIP now → Public 24h
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={() => applyPreset("exclusive_now_vip_6h_public_24h")}>
                    Exclusive → VIP 6h → Public 24h
                  </Button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
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
                  <label className="text-xs text-[var(--muted)]">VIP release delay (optional)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={vipHours}
                      onChange={(e) => setVipHours(e.target.value)}
                      placeholder="0"
                      className="w-20"
                    />
                    <span className="text-xs text-[var(--muted)]">hrs</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {["1", "6", "12", "24", "48", "72"].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setVipHours(h)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          vipHours === h
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">Blank or 0 = VIPs see now.</div>
                </div>

                <div>
                  <label className="text-xs text-[var(--muted)]">Public release delay (optional)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={publicHours}
                      onChange={(e) => setPublicHours(e.target.value)}
                      placeholder="0"
                      className="w-20"
                    />
                    <span className="text-xs text-[var(--muted)]">hrs</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {["1", "6", "12", "24", "48", "72"].map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setPublicHours(h)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                          publicHours === h
                            ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                            : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--text)]"
                        )}
                      >
                        {h}h
                      </button>
                    ))}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted)]">Blank or 0 = Public sees now.</div>
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
          </div>
        )}
      </ModalShell>
    </div>
  )
}
