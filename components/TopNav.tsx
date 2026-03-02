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
        "relative px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 rounded-lg",
        active
          ? "text-[var(--text)] bg-[var(--surface-2)] border border-[var(--border)]"
          : "text-[var(--muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]",
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
    "sticky top-0 z-[6000] border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md"

  if (loadingNav) {
    return (
      <div className={barClass}>
        <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-bold tracking-tight text-[var(--text)]">RHD</div>
            <div className="hidden sm:flex items-center gap-1 ml-1">
              <div className="h-7 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" />
              <div className="h-7 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" />
              <div className="h-7 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" />
            </div>
          </div>
          <div className="h-7 w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] animate-pulse" />
        </div>
      </div>
    )
  }

  if (!email) return null

  return (
    <div className={barClass}>
      <div className="mx-auto max-w-6xl px-5 h-14 flex items-center justify-between gap-3">
        {/* Left: Logo + nav */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2 group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--accent)] shadow-[0_0_12px_var(--accent-dim)]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 11L5 4L7 8L9 5.5L12 11" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-[13px] font-bold tracking-tight text-[var(--text)]">
              RHD <span className="text-[var(--muted)] font-medium">Wholesale</span>
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-0.5 ml-1">
            <NavLink href="/dashboard" label="Browse" />
            <NavLink href="/buy-box" label="Buy Box" />
            <NavLink href="/offers" label="My Offers" />
            {isAdmin && <NavLink href="/admin" label="Admin" />}
          </div>
        </div>

        {/* Right: email + theme + signout */}
        <div className="flex items-center gap-2">
          <div className="hidden md:block text-[12px] text-[var(--muted)] mr-1">{email}</div>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
          >
            {theme === "dark" ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
            )}
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.replace("/login")
            }}
            className="flex h-8 items-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile nav row */}
      <div className="sm:hidden px-5 pb-2.5 flex gap-1">
        <NavLink href="/dashboard" label="Browse" />
        <NavLink href="/buy-box" label="Buy Box" />
        <NavLink href="/offers" label="My Offers" />
        {isAdmin && <NavLink href="/admin" label="Admin" />}
      </div>
    </div>
  )
}
