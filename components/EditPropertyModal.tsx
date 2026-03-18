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
  due_diligence_date?: string | null
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
  const [dueDiligenceDate, setDueDiligenceDate] = useState("")

  const [originalAddress, setOriginalAddress] = useState("")
  const [originalLat, setOriginalLat] = useState("")
  const [originalLng, setOriginalLng] = useState("")

  useEffect(() => {
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
    setDueDiligenceDate(property.due_diligence_date ?? "")

    setOriginalAddress(property.address ?? "")
    setOriginalLat(String(property.lat ?? ""))
    setOriginalLng(String(property.lng ?? ""))
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

  const save = async () => {
    if (saving) return
    setErrorMsg(null)

    if (addressChanged && lat.trim() === originalLat.trim() && lng.trim() === originalLng.trim()) {
      setErrorMsg("Address changed — click Geocode (or manually update lat/lng) before saving.")
      return
    }

    if (!canSubmit) {
      setErrorMsg("Please fill all required fields.")
      return
    }

    setSaving(true)

    const { error } = await supabase
      .from("properties")
      .update({
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
        due_diligence_date: dueDiligenceDate.trim() || null,
      })
      .eq("id", property.id)

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

              <div className="md:col-span-2">
                <label className="text-xs text-[var(--muted)]">Photo URL (optional)</label>
                <Input
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.target.value)}
                  placeholder="https://photos.google.com/..."
                  className="mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-[var(--muted)]">Due Diligence Date <span className="text-[10px] text-[var(--accent)]">(admin only)</span></label>
                <Input
                  type="date"
                  value={dueDiligenceDate}
                  onChange={(e) => setDueDiligenceDate(e.target.value)}
                  className="mt-1"
                />
                <div className="mt-1 text-[11px] text-[var(--muted)]">
                  If passed while Under Contract, deal auto-archives as Closed Lost.
                </div>
              </div>
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
