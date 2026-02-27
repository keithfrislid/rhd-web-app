"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"

export function useViewedProperties(propertyIds: string[]) {
  const [loading, setLoading] = useState(false)
  const [viewedIds, setViewedIds] = useState<Set<string>>(new Set())

  // Tracks which exact "set" of IDs we have hydrated from the DB.
  // Used to prevent first-paint flashes when propertyIds changes from [] -> [ids...].
  const hydratedKeyRef = useRef<string>("")

  // Stable key for the current propertyIds set (order-independent).
  const idsKey = useMemo(() => {
    if (!propertyIds || propertyIds.length === 0) return ""
    return [...propertyIds].sort().join(",")
  }, [propertyIds])

  // If we have IDs but haven't hydrated this exact set yet, treat as loading immediately.
  const shouldTreatAsLoading = idsKey !== "" && hydratedKeyRef.current !== idsKey

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // If there are no properties, reset and consider it hydrated.
      if (!idsKey) {
        hydratedKeyRef.current = ""
        setViewedIds(new Set())
        setLoading(false)
        return
      }

      setLoading(true)

      try {
        const { data: userRes } = await supabase.auth.getUser()
        const user = userRes.user

        // If not logged in, clear and consider this set hydrated (so we don't "load forever").
        if (!user) {
          if (cancelled) return
          setViewedIds(new Set())
          hydratedKeyRef.current = idsKey
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
        hydratedKeyRef.current = idsKey
      } catch {
        if (!cancelled) {
          setViewedIds(new Set())
          // Mark hydrated anyway to avoid repeated "loading" flashes if the query fails transiently.
          hydratedKeyRef.current = idsKey
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [idsKey, propertyIds])

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
      // If it fails, we don't "unview" — it's not worth the jank.
      // Next refresh will re-sync from DB.
    }
  }

  const unmarkViewed = async (propertyId: string) => {
    try {
      const { data: userRes } = await supabase.auth.getUser()
      const user = userRes.user
      if (!user) return

      // Optimistic update
      setViewedIds((prev) => {
        const next = new Set(prev)
        next.delete(propertyId)
        return next
      })

      await supabase
        .from("viewed_properties")
        .delete()
        .eq("user_id", user.id)
        .eq("property_id", propertyId)
    } catch {
      // Sync will correct on next load.
    }
  }

  return {
    viewedIds,
    viewedLoading: loading || shouldTreatAsLoading,
    markViewed,
    unmarkViewed,
  }
}