"use client"

import AdminOffersPanel from "@/components/AdminOffersPanel"
import type { PropertyRow } from "@/lib/hooks/useAdminData"
import { formatMoney } from "@/lib/properties"

import { ModalShell } from "@/components/ui/ModalShell"
import { Card } from "@/components/ui/Card"
import { Badge } from "@/components/ui/Badge"
import { Button } from "@/components/ui/Button"

function spread(p: { arv: number; price: number; repairs: number }) {
  return (p.arv ?? 0) - (p.price ?? 0) - (p.repairs ?? 0)
}

function formatDateTime(ts: string | null | undefined) {
  if (!ts) return "—"
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function statusBadge(p: PropertyRow): {
  label: string
  variant: "default" | "success" | "warning" | "danger" | "outline"
} {
  const isClosedWon = !!p.is_archived && p.closed_outcome === "won"
  const isClosedLost = !!p.is_archived && p.closed_outcome === "lost"
  const isUnderContract = p.status === "Under Contract" && !p.is_archived
  const isActive = !p.is_archived && p.status !== "Under Contract"

  if (isClosedWon) return { label: "Closed Won", variant: "success" }
  if (isClosedLost) return { label: "Closed Lost", variant: "warning" }
  if (isUnderContract) return { label: "Under Contract", variant: "warning" }
  if (isActive) return { label: "Active", variant: "outline" }
  return { label: "—", variant: "default" }
}

type Props = {
  open: boolean
  property: PropertyRow | null
  pendingOffersCount: number

  onClose: () => void
  onRefresh: () => void

  onEdit: (p: PropertyRow) => void
  onDelete: (propertyId: string, address: string) => void
  onCloseProperty: (p: PropertyRow, outcome: "won" | "lost") => void

  deleteBusy: string | null
  closeBusy: string | null

  onAcceptedOffer: () => void
}

export default function AdminPropertyDetailsModal({
  open,
  property,
  pendingOffersCount,
  onClose,
  onRefresh,
  onEdit,
  onDelete,
  onCloseProperty,
  deleteBusy,
  closeBusy,
  onAcceptedOffer,
}: Props) {
  if (!open || !property) return null

  const s = statusBadge(property)

  return (
    <div className="fixed inset-0 z-[6000] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm md:items-center">
      <ModalShell
        title={property.address}
        description={`Property ID: ${property.id.slice(0, 6)}…${property.id.slice(-4)}`}
        className="w-full max-w-6xl"
        right={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        }
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={s.variant}>{s.label}</Badge>

              {pendingOffersCount > 0 && (
                <Badge variant="accent">
                  {pendingOffersCount} pending offer{pendingOffersCount === 1 ? "" : "s"}
                </Badge>
              )}

              {property.visibility && <Badge variant="muted">Visibility: {property.visibility}</Badge>}

              {property.is_accepting_offers === false && <Badge variant="muted">Offers: locked</Badge>}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={() => onEdit(property)}>
                Edit
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCloseProperty(property, "won")}
                disabled={closeBusy === property.id}
              >
                {closeBusy === property.id ? "Closing…" : "Close Won"}
              </Button>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => onCloseProperty(property, "lost")}
                disabled={closeBusy === property.id}
              >
                {closeBusy === property.id ? "Closing…" : "Close Lost"}
              </Button>

              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(property.id, property.address)}
                disabled={deleteBusy === property.id}
              >
                {deleteBusy === property.id ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Card className="p-4">
              <div className="text-xs text-[var(--muted)]">Summary</div>

              <div className="mt-2 grid grid-cols-2 gap-3">
                <Stat label="Price" value={formatMoney(property.price)} />
                <Stat label="Spread" value={formatMoney(spread(property))} />
                <Stat label="Beds" value={`${property.beds ?? 0}`} />
                <Stat label="Baths" value={`${property.baths ?? 0}`} />
                <Stat label="ARV" value={formatMoney(property.arv)} />
                <Stat label="Repairs" value={formatMoney(property.repairs)} />
                <Stat label="Sqft" value={(property.sqft ?? 0).toLocaleString()} />
                <Stat label="Acres" value={`${property.acres ?? 0}`} />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--muted)]">
                <Stat label="Created" value={formatDateTime(property.created_at)} />
                <Stat label="VIP release" value={formatDateTime(property.vip_release_at)} />
                <Stat label="Public release" value={formatDateTime(property.public_release_at)} />

                {!!property.is_archived && (
                  <>
                    <Stat label="Closed at" value={formatDateTime(property.closed_at)} />
                    <Stat label="Closed reason" value={property.closed_reason || "—"} />
                  </>
                )}

                <Stat
                  label="Location"
                  value={
                    property.lat && property.lng
                      ? `${property.lat.toFixed(5)}, ${property.lng.toFixed(5)}`
                      : "—"
                  }
                />
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <div className="max-h-[70vh] overflow-auto rounded-2xl">
              <AdminOffersPanel
                propertyId={property.id}
                propertyAddress={property.address}
                onAccepted={onAcceptedOffer}
              />
            </div>
          </div>
        </div>
      </ModalShell>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-[var(--muted)]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-[var(--text)]">{value}</div>
    </div>
  )
}
