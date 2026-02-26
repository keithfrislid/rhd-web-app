"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { isCurrentUserAdmin } from "@/lib/admin"

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <Link
      href={href}
      className={[
        "rounded-xl px-3 py-2 text-sm font-semibold transition",
        active
          ? "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]"
          : "border border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]",
      ].join(" ")}
    >
      {label}
    </Link>
  )
}

export default function TopNav() {
  const router = useRouter()
  const [loadingNav, setLoadingNav] = useState(true)
  const [email, setEmail] = useState<string>("")
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (!cancelled) {
          setEmail("")
          setIsAdmin(false)
          setLoadingNav(false)
        }
        return
      }

      const admin = await isCurrentUserAdmin(user.id)

      if (!cancelled) {
        setEmail(user.email ?? "")
        setIsAdmin(admin)
        setLoadingNav(false)
      }
    }

    run()

    return () => {
      cancelled = true
    }
  }, [])

  const barClass =
    "sticky top-0 z-[6000] border-b border-[var(--border)] bg-[var(--background)]"

  if (loadingNav) {
    return (
      <div className={barClass}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="font-extrabold tracking-wide text-[var(--text)]">RHD</div>
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <div className="h-9 w-24 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
              <div className="h-9 w-24 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
              <div className="h-9 w-20 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
            </div>
          </div>
          <div className="h-9 w-24 rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
        </div>
      </div>
    )
  }

  if (!email) return null

  return (
    <div className={barClass}>
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-extrabold tracking-wide text-[var(--text)]">
            RHD
          </Link>

          <div className="hidden sm:flex items-center gap-2 ml-2">
            <NavLink href="/dashboard" label="Browse" />
            <NavLink href="/buy-box" label="Buy Box" />
            <NavLink href="/offers" label="My Offers" />
            {isAdmin && <NavLink href="/admin" label="Admin" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block text-xs text-[var(--muted)]">{email}</div>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.replace("/login")
            }}
            className="rounded-xl border border-[var(--border)] px-3 py-2 text-sm text-[var(--text)] hover:bg-[var(--surface)]"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="sm:hidden px-4 pb-3 flex gap-2">
        <NavLink href="/dashboard" label="Browse" />
        <NavLink href="/buy-box" label="Buy Box" />
        <NavLink href="/offers" label="My Offers" />
        {isAdmin && <NavLink href="/admin" label="Admin" />}
      </div>
    </div>
  )
}