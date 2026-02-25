import { supabase } from "@/lib/supabase"

export type PropertyStatus = "New" | "Price Drop" | "Under Contract"
export type PropertyVisibility = "public" | "vip" | "exclusive"

export type Property = {
  id: string
  address: string
  price: number
  beds: number
  baths: number
  sqft: number
  acres: number
  arv: number
  repairs: number
  lat: number
  lng: number
  photoUrl: string
  status: PropertyStatus

  // Visibility / First dibs
  visibility?: PropertyVisibility
  vipReleaseAt?: string | null
  publicReleaseAt?: string | null
  exclusiveUserId?: string | null

  isArchived?: boolean
  closedOutcome?: "won" | "lost" | null
  closedAt?: string | null
  closedReason?: string | null

  // Offer controls (v1)
  offerDeadline?: string | null
  isAcceptingOffers?: boolean
  acceptedOfferId?: string | null
}

export function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

export async function fetchProperties(opts?: { includeUnderContract?: boolean }): Promise<Property[]> {
  const includeUnderContract = !!opts?.includeUnderContract

  let q = supabase
    .from("properties")
    .select(
      "id,address,price,beds,baths,sqft,acres,arv,repairs,lat,lng,photo_url,status,offer_deadline,is_accepting_offers,accepted_offer_id,is_archived,closed_outcome,closed_at,closed_reason,visibility,vip_release_at,public_release_at,exclusive_user_id"
    )
    .eq("is_archived", false)
    .order("created_at", { ascending: false })

  if (!includeUnderContract) {
    q = q.neq("status", "Under Contract")
  }

  const { data, error } = await q

  if (error) {
    console.warn("fetchProperties error:", error.message)
    return []
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    address: row.address,
    price: row.price,
    beds: row.beds,
    baths: Number(row.baths),
    sqft: row.sqft,
    acres: Number(row.acres),
    arv: row.arv,
    repairs: row.repairs,
    lat: row.lat,
    lng: row.lng,
    photoUrl: row.photo_url ?? "https://photos.google.com/",
    status: row.status as PropertyStatus,

    visibility: (row.visibility as PropertyVisibility) ?? "public",
    vipReleaseAt: row.vip_release_at ?? null,
    publicReleaseAt: row.public_release_at ?? null,
    exclusiveUserId: row.exclusive_user_id ?? null,

    offerDeadline: row.offer_deadline ?? null,
    isAcceptingOffers:
      typeof row.is_accepting_offers === "boolean" ? row.is_accepting_offers : true,
    acceptedOfferId: row.accepted_offer_id ?? null,

    isArchived: !!row.is_archived,
    closedOutcome: (row.closed_outcome as "won" | "lost" | null) ?? null,
    closedAt: row.closed_at ?? null,
    closedReason: row.closed_reason ?? null,
  }))
}
