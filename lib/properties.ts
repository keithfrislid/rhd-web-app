import { supabase } from "@/lib/supabase"

export type PropertyStatus = "New" | "Price Drop" | "Under Contract"

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
}

export function formatMoney(n: number) {
  return `$${n.toLocaleString()}`
}

export async function fetchProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from("properties")
    .select("id,address,price,beds,baths,sqft,acres,arv,repairs,lat,lng,photo_url,status")
    .order("created_at", { ascending: false })

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
  }))
}
