import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

export type PropertyRow = {
  id: string
  address: string
  status: "New" | "Price Drop" | "Under Contract"
  photo_url: string | null
  price: number
  beds: number
  baths: number
  sqft: number
  acres: number
  arv: number
  repairs: number
  lat: number
  lng: number
  created_at: string
  is_accepting_offers?: boolean
  accepted_offer_id?: string | null

  // Visibility / first dibs
  visibility?: "public" | "vip" | "exclusive"
  exclusive_user_id?: string | null
  vip_release_at?: string | null
  public_release_at?: string | null

  // closure / archive
  is_archived?: boolean
  closed_outcome?: "won" | "lost" | null
  closed_reason?: string | null
  closed_at?: string | null
}

export type PendingOfferRow = {
  id: string
  property_id: string
  user_id: string
  offer_price: number
  notes: string | null
  status: "pending"
  created_at: string
  buyer: {
    user_id: string
    email: string | null
    first_name: string | null
    last_name: string | null
  } | null
  properties: {
    id: string
    address: string
    price: number
    status: "New" | "Price Drop" | "Under Contract"
  } | null
}

export type AdminView = "properties" | "inbox" | "users" | "buyboxes" | "buyers"

type Params = {
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  setErrorMsg: (msg: string | null) => void
}

export function useAdminData({
  selectedId,
  setSelectedId,
  setErrorMsg,
}: Params) {
  const [propsLoading, setPropsLoading] = useState(true)
  const [properties, setProperties] = useState<PropertyRow[]>([])

  const [inboxLoading, setInboxLoading] = useState(true)
  const [pendingOffers, setPendingOffers] = useState<PendingOfferRow[]>([])

  const [usersLoading, setUsersLoading] = useState(true)
  const [pendingUsersCount, setPendingUsersCount] = useState<number>(0)

  const pendingCountByProperty = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of pendingOffers) {
      map.set(o.property_id, (map.get(o.property_id) ?? 0) + 1)
    }
    return map
  }, [pendingOffers])

  const loadProperties = async () => {
    setPropsLoading(true)
    setErrorMsg(null)

    try {
      // Admin should load all inventory (active + under contract + closed won/lost),
      // and use client-side filters to view the right subset.
      const { data, error } = await supabase
        .from("properties")
        .select(
          "id,address,status,photo_url,price,beds,baths,sqft,acres,arv,repairs,lat,lng,created_at,is_accepting_offers,accepted_offer_id,is_archived,closed_outcome,closed_reason,closed_at,visibility,exclusive_user_id,vip_release_at,public_release_at"
        )
        .order("created_at", { ascending: false })
      if (error) throw error

      const rows = (data ?? []) as PropertyRow[]
      setProperties(rows)

      if (rows.length === 0) {
        setSelectedId(null)
      } else if (!selectedId || !rows.some((r) => r.id === selectedId)) {
        setSelectedId(rows[0].id)
      }
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load properties.")
      setProperties([])
      setSelectedId(null)
    } finally {
      setPropsLoading(false)
    }
  }

  const loadInbox = async () => {
    setInboxLoading(true)
    setErrorMsg(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-offers/inbox`,
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

      const rows = Array.isArray(json?.offers) ? json.offers : []
      // Normalize property field name to `properties` (component expects it)
      const normalized = rows.map((o: any) => ({
        ...o,
        properties: o.properties ?? o.property ?? null,
      }))

      setPendingOffers(normalized as PendingOfferRow[])
    } catch (e: any) {
      setPendingOffers([])
      setErrorMsg(e?.message ?? "Failed to load inbox")
    } finally {
      setInboxLoading(false)
    }
  }

  const loadPendingUsersCount = async () => {
    setUsersLoading(true)

    // IMPORTANT:
    // The AdminUsersPanel loads pending users through the `admin-users` Edge Function.
    // Doing a direct `profiles` select here can return 0 due to RLS, even for admins.
    // So we count pending users via the same Edge Function to keep the badge correct.
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error("No session")

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users`,
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

      const users = Array.isArray(json?.users) ? json.users : []
      const pending = users.filter((u: any) => u?.role === "pending")
      setPendingUsersCount(pending.length)
    } catch {
      setPendingUsersCount(0)
    } finally {
      setUsersLoading(false)
    }
  }

  const refreshAll = async () => {
    await Promise.all([loadProperties(), loadInbox(), loadPendingUsersCount()])
  }

  // Live updates
  useEffect(() => {
    const handler = () => loadInbox()
    window.addEventListener("rhd:offers-changed", handler)
    return () => window.removeEventListener("rhd:offers-changed", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handler = () => loadPendingUsersCount()
    window.addEventListener("rhd:users-changed", handler)
    return () => window.removeEventListener("rhd:users-changed", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    // data
    properties,
    pendingOffers,
    pendingUsersCount,
    pendingCountByProperty,

    // loading
    propsLoading,
    inboxLoading,
    usersLoading,

    // actions
    loadProperties,
    loadInbox,
    loadPendingUsersCount,
    refreshAll,
  }
}
