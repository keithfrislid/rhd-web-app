"use client"

import { useEffect, useMemo, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useViewedProperties(propertyIds: string[]) {
  const [loading, setLoading] = useState(false)
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())

  const idsKey = useMemo(() => propertyIds.slice().sort().join(","), [propertyIds])

  // Load viewed rows for this user for the visible property set
  useEffect(() => {
    let cancelled = false

    const run = async () => {
      if (!propertyIds.length) {
        setViewedIds(new Set())
        return
      }

      setLoading(true)
      try {
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes.user
        if (!user) {
          setViewedIds(new Set())
          return
        }

        const { data, error } = await supabase
          .from("viewed_properties")
          .select("property_id")
          .eq("user_id", user.id)
          .in("property_id", propertyIds)

        if (error) throw error
        if (cancelled) return

        setViewedIds(new Set((data ?? []).map((r) => r.property_id)))
      } catch {
        if (!cancelled) setViewedIds(new Set())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  const markViewed = async (propertyId: string) => {
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) return

      // Optimistic update so UI feels instant
      setViewedIds((prev) => new Set(prev).add(propertyId))

      // Upsert on (user_id, property_id)
      await supabase.from("viewed_properties").upsert(
        {
          user_id: user.id,
          property_id: propertyId,
          viewed_at: new Date().toISOString(),
        },
        { onConflict: "user_id,property_id" }
      )
    } catch {
      // If it fails, we don't “unview” — it’s not worth the jank.
      // Next refresh will re-sync from DB.
    }
  }

  return { viewedIds, viewedLoading: loading, markViewed }
}