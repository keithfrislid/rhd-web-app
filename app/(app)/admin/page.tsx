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
import AdminPropertyDetailsModal from "@/components/admin/AdminPropertyDetailsModal"
import AdminInboxPanel from "@/components/admin/AdminInboxPanel"
import AdminBuyBoxesPanel from "@/components/admin/AdminBuyBoxesPanel"
import AdminBuyerRankingsPanel from "@/components/admin/AdminBuyerRankingsPanel"

import { PageShell } from "@/components/ui/PageShell"
import { Card } from "@/components/ui/Card"

export default function AdminPage() {
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [view, setView] = useState<AdminView>("properties")

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
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

    // If we just deleted the open deal, close the details view.
    if (selectedId === propertyId) {
      setDetailsOpen(false)
      setSelectedId(null)
    }
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

  if (checkingAdmin) {
    return (
      <main className="w-full">
        <PageShell>
          <Card className="p-4">
            <p className="text-sm text-[var(--muted)]">Checking admin access…</p>
          </Card>
        </PageShell>
      </main>
    )
  }

  return (
    <main className="w-full">
      <PageShell className="space-y-4">
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
          <Card className="border-[var(--danger)]/30 bg-[var(--danger)]/10 p-4">
            <div className="text-sm text-[var(--text)]">{errorMsg}</div>
          </Card>
        )}

        {view === "properties" && (
          <AdminPropertiesPanel
            propsLoading={propsLoading}
            properties={properties}
            pendingCountByProperty={pendingCountByProperty}
            onOpen={(propertyId) => {
              setSelectedId(propertyId)
              setDetailsOpen(true)
            }}
          />
        )}

        {view === "inbox" && (
          <AdminInboxPanel
            inboxLoading={inboxLoading}
            pendingOffers={pendingOffers}
            onOpenProperty={(propertyId) => {
              setView("properties")
              setSelectedId(propertyId)
              setDetailsOpen(true)
            }}
          />
        )}

        {view === "users" && <AdminUsersPanel />}

        {view === "buyboxes" && <AdminBuyBoxesPanel />}

        {view === "buyers" && <AdminBuyerRankingsPanel />}
      </PageShell>

      <AdminPropertyDetailsModal
        open={detailsOpen}
        property={selected}
        pendingOffersCount={selectedId ? (pendingCountByProperty.get(selectedId) ?? 0) : 0}
        onClose={() => {
          setDetailsOpen(false)
          setSelectedId(null)
        }}
        onRefresh={refreshAll}
        onEdit={(p) => {
          setDetailsOpen(false)
          setEditingProperty(p)
        }}
        onDelete={deleteProperty}
        onCloseProperty={closeProperty}
        deleteBusy={deleteBusy}
        closeBusy={closeBusy}
        onAcceptedOffer={refreshAll}
      />

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