"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import AdminOffersPanel from "@/components/AdminOffersPanel"
import AdminCreatePropertyModal from "@/components/AdminCreatePropertyModal"
import { formatMoney } from "@/lib/properties"
import { isCurrentUserAdmin } from "@/lib/admin"

type PropertyRow = {
  id: string
  address: string
  status: "New" | "Price Drop" | "Under Contract"
  price: number
  beds: number
  baths: number
  arv: number
  repairs: number
  created_at: string
  is_accepting_offers?: boolean
  accepted_offer_id?: string | null
}

function spread(p: PropertyRow) {
  return p.arv - p.price - p.repairs
}

export default function AdminPage() {
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [propsLoading, setPropsLoading] = useState(true)

  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedId) ?? null,
    [properties, selectedId]
  )

  const loadProperties = async () => {
    setPropsLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from("properties")
      .select(
        "id,address,status,price,beds,baths,arv,repairs,created_at,is_accepting_offers,accepted_offer_id"
      )
      .order("created_at", { ascending: false })

    if (error) {
      setErrorMsg(error.message)
      setProperties([])
      setPropsLoading(false)
      return
    }

    const rows = (data ?? []) as PropertyRow[]
    setProperties(rows)
    setPropsLoading(false)

    // keep selection stable; if deleted, pick first
    if (rows.length === 0) {
      setSelectedId(null)
    } else if (!selectedId || !rows.some((r) => r.id === selectedId)) {
      setSelectedId(rows[0].id)
    }
  }

  const deleteProperty = async (propertyId: string, address: string) => {
    if (deleteBusy) return
    const ok = window.confirm(
      `Delete this property?\n\n${address}\n\nThis cannot be undone.`
    )
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
    await loadProperties()
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      // AuthShell already guarantees a session, but admin check is still needed.
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
      await loadProperties()
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
        <p className="text-sm text-white/70">Checking admin access…</p>
      </main>
    )
  }

  return (
    <main className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-white/70">
            Manage properties and accept offers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-white text-black px-3 py-2 text-sm font-semibold hover:opacity-90"
          >
            + Add Property
          </button>

          <button
            onClick={loadProperties}
            className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: property list */}
        <div className="lg:col-span-2 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/5">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Properties</div>
              <div className="text-xs text-white/60">
                {propsLoading ? "Loading…" : `${properties.length} total`}
              </div>
            </div>
          </div>

          {propsLoading ? (
            <div className="p-4 text-sm text-white/70">Loading properties…</div>
          ) : properties.length === 0 ? (
            <div className="p-4 text-sm text-white/70">
              No properties found. Click{" "}
              <span className="font-semibold">+ Add Property</span>.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {properties.map((p) => {
                const active = p.id === selectedId
                const isLocked =
                  p.is_accepting_offers === false || !!p.accepted_offer_id

                return (
                  <div
                    key={p.id}
                    className={`px-4 py-3 transition ${
                      active ? "bg-white/10" : "hover:bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(p.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.address}</div>
                          <div className="mt-0.5 text-xs text-white/60">
                            {p.beds} bd • {p.baths} ba • {formatMoney(p.price)}
                          </div>
                          <div className="mt-1 text-xs text-white/60">
                            Spread:{" "}
                            <span className="text-white/80 font-semibold">
                              {formatMoney(spread(p))}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          <span className="text-[11px] rounded-full border border-white/15 bg-black/30 px-2 py-1 text-white/70 font-semibold">
                            {p.status}
                          </span>
                          {isLocked && (
                            <span className="text-[11px] rounded-full border border-white/10 bg-white/5 px-2 py-1 text-white/60 font-semibold">
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="mt-3 flex items-center justify-between">
                      <div className="text-[11px] text-white/50">
                        ID: {p.id.slice(0, 6)}…{p.id.slice(-4)}
                      </div>

                      <button
                        onClick={() => deleteProperty(p.id, p.address)}
                        disabled={deleteBusy === p.id}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                          deleteBusy === p.id
                            ? "border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                            : "border-red-400/30 bg-red-500/10 text-red-200 hover:bg-red-500/15"
                        }`}
                      >
                        {deleteBusy === p.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Right: offers panel */}
        <div className="lg:col-span-3">
          {selected ? (
            <AdminOffersPanel
              propertyId={selected.id}
              propertyAddress={selected.address}
              onAccepted={loadProperties}
            />
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
              Select a property to view offers.
            </div>
          )}
        </div>
      </div>

      <AdminCreatePropertyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={loadProperties}
      />
    </main>
  )
}
