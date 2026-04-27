"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Badge } from "@/components/ui/Badge"
import { cn } from "@/lib/cn"
import type { AdminView } from "@/lib/hooks/useAdminData"

export default function AdminHeaderTabs({
  view,
  setView,
  inboxLoading,
  inboxCount,
  usersLoading,
  pendingUsersCount,
  draftsCount,
  onAddProperty,
  onRefresh,
}: {
  view: AdminView
  setView: (v: AdminView) => void
  inboxLoading: boolean
  inboxCount: number
  usersLoading: boolean
  pendingUsersCount: number
  draftsCount: number
  onAddProperty: () => void
  onRefresh: () => void
}) {
  const tabs: Array<{
    key: AdminView
    label: string
    right?: React.ReactNode
  }> = [
    { key: "properties", label: "Properties" },
    {
      key: "drafts",
      label: "Drafts",
      right: draftsCount > 0 ? (
        <TabCount loading={false} count={draftsCount} tone="neutral" />
      ) : undefined,
    },
    {
      key: "inbox",
      label: "Inbox",
      right: (
        <TabCount
          loading={inboxLoading}
          count={inboxCount}
          tone={inboxCount > 0 ? "warn" : "neutral"}
        />
      ),
    },
    {
      key: "users",
      label: "Users",
      right: (
        <TabCount
          loading={usersLoading}
          count={pendingUsersCount}
          tone={pendingUsersCount > 0 ? "warn" : "neutral"}
        />
      ),
    },
    { key: "buyboxes", label: "Buy Boxes" },
    { key: "buyers", label: "Buyer Rankings" },
    { key: "analytics", label: "Analytics" },
  ]

  return (
    <div className="space-y-3">
      {/* Title + Actions */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-lg font-semibold text-[var(--text)]">Admin</div>
          <div className="text-xs text-[var(--muted)]">
            Manage properties, offers, users, and buyer settings.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={onRefresh}>
            Refresh
          </Button>
          <Button variant="primary" onClick={onAddProperty}>
            Add Property
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = view === t.key
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setView(t.key)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                  "border border-transparent",
                  active
                    ? "bg-[var(--accent)] text-white"
                    : "bg-transparent text-[var(--text)] hover:bg-black/20",
                  active ? "shadow-sm" : ""
                )}
              >
                <span className="whitespace-nowrap">{t.label}</span>
                {t.right}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function TabCount({
  loading,
  count,
  tone,
}: {
  loading: boolean
  count: number
  tone: "neutral" | "warn"
}) {
  if (loading) {
    return (
      <Badge variant="outline" className="ml-0.5">
        …
      </Badge>
    )
  }

  if (!count) {
    return (
      <Badge variant="outline" className="ml-0.5">
        0
      </Badge>
    )
  }

  // warn tone when there are pending items
  return (
    <Badge
      variant={tone === "warn" ? "accent" : "outline"}
      className="ml-0.5"
      title={`${count}`}
    >
      {count}
    </Badge>
  )
}