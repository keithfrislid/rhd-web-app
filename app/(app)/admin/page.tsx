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

type PendingOfferRow = {
  id: string
  property_id: string
  user_id: string
  offer_price: number
  notes: string | null
  status: "pending"
  created_at: string
  properties: {
    id: string
    address: string
    price: number
    arv: number
    repairs: number
    status: "New" | "Price Drop" | "Under Contract"
    is_accepting_offers?: boolean
    accepted_offer_id?: string | null
  } | null
}

type AdminView = "properties" | "inbox"

function spread(p: { arv: number; price: number; repairs: number }) {
  return p.arv - p.price - p.repairs
}

function delta(offer: number, ask: number) {
  return offer - ask
}

function formatDelta(n: number) {
  const sign = n > 0 ? "+" : ""
  return `${sign}${formatMoney(n)}`
}

export default function AdminPage() {
  const router = useRouter()

  const [checkingAdmin, setCheckingAdmin] = useState(true)

  const [view, setView] = useState<AdminView>("properties")

  const [propsLoading, setPropsLoading] = useState(true)
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [inboxLoading, setInboxLoading] = useState(true)
  const [pendingOffers, setPendingOffers] = useState<PendingOfferRow[]>([])

  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState<string | null>(null)

  const selected = useMemo(
    () => properties.find((p) => p.id === selectedId) ?? null,
    [properties, selectedId]
  )

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

  const loadInbox = async () => {
    setInboxLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase
      .from("offers")
      .select(
        `
        id,
        property_id,
        user_id,
        offer_price,
        notes,
        status,
        created_at,
        property:properties!offers_property_id_fkey (
          id,address,price,status
        )
      `
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })

    if (error) {
      setPendingOffers([])
      setErrorMsg(error.message)
      setInboxLoading(false)
      return
    }

    // Supabase sometimes returns joined rows as an array; normalize to a single object.
    const rows = (data ?? []).map((o: any) => {
      const prop = Array.isArray(o.property) ? o.property[0] ?? null : o.property ?? null
      return { ...o, properties: prop }
    })

    setPendingOffers(rows as PendingOfferRow[])
    setInboxLoading(false)
  }

  const refreshAll = async () => {
    await Promise.all([loadProperties(), loadInbox()])
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
    await refreshAll()
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

      // Load both so the inbox tab is instant
      await refreshAll()
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Refresh inbox when offers change (accept/reject/submit/withdraw)
  useEffect(() => {
    const handler = () => loadInbox()
    window.addEventListener("rhd:offers-changed", handler)
    return () => window.removeEventListener("rhd:offers-changed", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checkingAdmin) {
    return (
      <main className="w-full">
        <p className="text-sm text-white/70">Checking admin access…</p>
      </main>
    )
  }

  return (
    <main className="w-full">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Admin</h1>
          <p className="mt-1 text-sm text-white/70">
            Manage properties and review pending offers.
          </p>

          {/* View toggle */}
          <div className="mt-3 inline-flex items-center gap-1 rounded-xl border border-white/15 bg-black/40 p-1">
            <button
              onClick={() => setView("properties")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                view === "properties"
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Properties
            </button>
            <button
              onClick={() => setView("inbox")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                view === "inbox"
                  ? "bg-white text-black"
                  : "text-white/70 hover:bg-white/10"
              }`}
            >
              Pending Offers{" "}
              <span className="ml-2 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-extrabold">
                {inboxLoading ? "…" : pendingOffers.length}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setCreateOpen(true)}
            className="rounded-xl bg-white text-black px-3 py-2 text-sm font-semibold hover:opacity-90"
          >
            + Add Property
          </button>

          <button
            onClick={refreshAll}
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

      {/* =============== VIEW: PROPERTIES =============== */}
      {view === "properties" && (
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
                  const pendingForProp = pendingCountByProperty.get(p.id) ?? 0

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

                            {pendingForProp > 0 && (
                              <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200">
                                {pendingForProp} pending offer
                                {pendingForProp === 1 ? "" : "s"}
                              </div>
                            )}
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
                onAccepted={refreshAll}
              />
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
                Select a property to view offers.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =============== VIEW: INBOX =============== */}
      {view === "inbox" && (
        <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="text-sm font-semibold">Pending Offer Inbox</div>
            <div className="text-xs text-white/60">
              {inboxLoading ? "Loading…" : `${pendingOffers.length} total`}
            </div>
          </div>

          {inboxLoading ? (
            <div className="p-4 text-sm text-white/70">Loading pending offers…</div>
          ) : pendingOffers.length === 0 ? (
            <div className="p-4 text-sm text-white/70">No pending offers right now.</div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-black/30 text-xs font-semibold text-white/60">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-3">Property</th>
                    <th className="px-4 py-3">Ask</th>
                    <th className="px-4 py-3">Offer</th>
                    <th className="px-4 py-3">Delta</th>
                    <th className="px-4 py-3">Submitted</th>
                    <th className="px-4 py-3">Notes</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {pendingOffers.map((o) => {
                    const p = o.properties
                    const ask = p?.price ?? 0
                    const d = p ? delta(o.offer_price, ask) : 0

                    const deltaTone =
                      d >= 0
                        ? "text-emerald-200 bg-emerald-500/10 border-emerald-400/25"
                        : "text-red-200 bg-red-500/10 border-red-400/25"

                    return (
                      <tr
                        key={o.id}
                        className="cursor-pointer hover:bg-white/5"
                        title="Open property in Admin"
                        onClick={() => {
                          setView("properties")
                          setSelectedId(o.property_id)
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">
                            {p?.address ?? "Unknown property"}
                          </div>
                          <div className="mt-0.5 text-xs text-white/50">
                            Property ID: {o.property_id.slice(0, 6)}…{o.property_id.slice(-4)}
                          </div>
                        </td>

                        <td className="px-4 py-3">{formatMoney(ask)}</td>

                        <td className="px-4 py-3 font-semibold">
                          {formatMoney(o.offer_price)}
                        </td>

                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold ${deltaTone}`}>
                            {formatDelta(d)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          {new Date(o.created_at).toLocaleString()}
                        </td>

                        <td className="px-4 py-3 text-white/70">
                          <span className="line-clamp-2">{o.notes ?? "—"}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="p-4 text-xs text-white/50 border-t border-white/10">
            Tip: Click a row to jump into the property’s offers panel and accept the winning offer.
          </div>
        </div>
      )}

      <AdminCreatePropertyModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshAll}
      />
    </main>
  )
}