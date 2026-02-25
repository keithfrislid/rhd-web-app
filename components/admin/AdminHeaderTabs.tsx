"use client"

import type { AdminView } from "@/lib/hooks/useAdminData"

type Props = {
  view: AdminView
  setView: (v: AdminView) => void

  inboxLoading: boolean
  inboxCount: number

  usersLoading: boolean
  pendingUsersCount: number

  onAddProperty: () => void
  onRefresh: () => void
}

export default function AdminHeaderTabs({
  view,
  setView,
  inboxLoading,
  inboxCount,
  usersLoading,
  pendingUsersCount,
  onAddProperty,
  onRefresh,
}: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-white/70">
          Manage properties, review offers, and approve users.
        </p>

        <div className="mt-3 inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/15 bg-black/40 p-1">
          <button
            onClick={() => setView("properties")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "properties" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
            }`}
          >
            Properties
          </button>

          <button
            onClick={() => setView("inbox")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "inbox" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
            }`}
          >
            Pending Offers{" "}
            <span className="ml-2 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-extrabold">
              {inboxLoading ? "…" : inboxCount}
            </span>
          </button>

          <button
            onClick={() => setView("users")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "users" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
            }`}
          >
            Approve Users{" "}
            <span className="ml-2 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] font-extrabold">
              {usersLoading ? "…" : pendingUsersCount}
            </span>
          </button>

          <button
            onClick={() => setView("buyboxes")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "buyboxes" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
            }`}
          >
            Buy Boxes
          </button>

          <button
            onClick={() => setView("buyers")}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
              view === "buyers" ? "bg-white text-black" : "text-white/70 hover:bg-white/10"
            }`}
          >
            Buyer Rankings
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={onAddProperty}
          className="rounded-xl bg-white text-black px-3 py-2 text-sm font-semibold hover:opacity-90"
        >
          + Add Property
        </button>

        <button
          onClick={onRefresh}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}