"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import AdminCreatePropertyModal from "@/components/AdminCreatePropertyModal"
import EditPropertyModal from "@/components/EditPropertyModal"
import AdminUsersPanel from "@/components/AdminUsersPanel"
import { isCurrentUserAdmin } from "@/lib/admin"
import { useAdminData, type AdminView, type PropertyRow } from "@/lib/hooks/useAdminData"
import AdminHeaderTabs from "@/components/admin/AdminHeaderTabs"
import AdminPropertiesPanel from "@/components/admin/AdminPropertiesPanel"
import AdminInboxPanel from "@/components/admin/AdminInboxPanel"
import AdminBuyBoxesPanel from "@/components/admin/AdminBuyBoxesPanel"
import AdminBuyerRankingsPanel from "@/components/admin/AdminBuyerRankingsPanel"

export default function AdminPage() {
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [view, setView] = useState<AdminView>("properties")

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [editingProperty, setEditingProperty] = useState<PropertyRow | null>(null)

  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)
  const [closeBusy, setCloseBusy] = useState<string | null>(null)

  const {
    properties,
    pendingOffers,
    pendingUsersCount,
    pendingCountByProperty,

    propsLoading,
    inboxLoading,
    usersLoading,
    refreshAll,
  } = useAdminData({
    selectedId,
    setSelectedId,
    setErrorMsg,
  })

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedId) ?? null,
    [properties, selectedId]
  )

  const deleteProperty = async (propertyId: string, address: string) => {
    if (deleteBusy) return
    const ok = window.confirm(`Delete this property?\n\n${address}\n\nThis cannot be undone.`)
    if (!ok) return

    setDeleteBusy(propertyId)
    setErrorMsg(null)

    const { error } = await supabase.from("properties").delete().eq("id", propertyId)

    if (error) {
      setErrorMsg(error.message)
      setDeleteBusy(null)
      return
    }

    setDeleteBusy(null)
    await refreshAll()
  }

  const closeProperty = async (p: PropertyRow, outcome: "won" | "lost") => {
    if (closeBusy) return

    try {
      setErrorMsg(null)

      const label =
        outcome === "won" ? "CLOSE WON (Sold/Assigned)" : "CLOSE LOST (DD expired / Cancelled)"

      const ok = window.confirm(
        `${label}?\n\n${p.address}\n\nThis will archive the property and hide it from buyers.`
      )
      if (!ok) return

      let closedReason: string | null = null
      if (outcome === "lost") {
        closedReason =
          window.prompt("Optional: reason (DD expired, seller cancelled, etc.)", "DD expired") ??
          null
        if (closedReason !== null) closedReason = closedReason.trim() || null
      }

      setCloseBusy(p.id)

      const { error } = await supabase
        .from("properties")
        .update({
          is_archived: true,
          closed_outcome: outcome,
          closed_at: new Date().toISOString(),
          closed_reason: closedReason,
        })
        .eq("id", p.id)

      if (error) throw error

      await refreshAll()
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to close property.")
    } finally {
      setCloseBusy(null)
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const adminOk = await isCurrentUserAdmin(user?.id ?? undefined)
      if (!adminOk) {
        router.replace("/dashboard")
        return
      }

      if (cancelled) return
      setCheckingAdmin(false)

      await refreshAll()
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // (Admin inventory includes closed/archived. Filtering is client-side in the panel.)

  if (checkingAdmin) {
    return (
      <main className="w-full">
        <p className="text-sm text-white/70">Checking admin access…</p>
      </main>
    )
  }

  return (
    <main className="w-full">
      <AdminHeaderTabs
        view={view}
        setView={setView}
        inboxLoading={inboxLoading}
        inboxCount={pendingOffers.length}
        usersLoading={usersLoading}
        pendingUsersCount={pendingUsersCount}
        onAddProperty={() => setCreateOpen(true)}
        onRefresh={refreshAll}
      />

      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {view === "properties" && (
        <AdminPropertiesPanel
          propsLoading={propsLoading}
          properties={properties}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          selected={selected}
          pendingCountByProperty={pendingCountByProperty}
          onEdit={(p) => setEditingProperty(p)}
          onDelete={deleteProperty}
          onClose={closeProperty}
          deleteBusy={deleteBusy}
          closeBusy={closeBusy}
          onAcceptedOffer={refreshAll}
        />
      )}

      {view === "inbox" && (
        <AdminInboxPanel
          inboxLoading={inboxLoading}
          pendingOffers={pendingOffers}
          onOpenProperty={(propertyId) => {
            setView("properties")
            setSelectedId(propertyId)
          }}
        />
      )}

      {view === "users" && <AdminUsersPanel />}

      {view === "buyboxes" && <AdminBuyBoxesPanel />}

      {view === "buyers" && <AdminBuyerRankingsPanel />}

      <AdminCreatePropertyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshAll}
      />

      {editingProperty && (
        <EditPropertyModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSaved={refreshAll}
        />
      )}
    </main>
  )
}
