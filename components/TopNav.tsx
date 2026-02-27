"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { isCurrentUserAdmin } from "@/lib/admin"
import { useTheme } from "@/components/ThemeProvider"

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
  const { theme, toggleTheme } = useTheme()
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
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-xl border border-[var(--border)] px-2.5 py-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)] transition-colors"
          >
            {theme === "dark" ? (
              /* Sun icon */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              /* Moon icon */
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>

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