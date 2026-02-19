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
      className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-white text-black"
          : "border border-white/15 text-white/80 hover:bg-white/10"
      }`}
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
      // AuthShell already ensures there is a session, but we still fetch user/email for display.
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        // Safety: if something weird happens, don't show nav.
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

  // Prevent flicker: render a minimal skeleton bar while we fetch admin/email
  if (loadingNav) {
    return (
      <div className="sticky top-0 z-[6000] border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="font-extrabold tracking-wide">RHD</div>
            <div className="hidden sm:flex items-center gap-2 ml-2">
              <div className="h-9 w-24 rounded-xl border border-white/10 bg-white/5" />
              <div className="h-9 w-24 rounded-xl border border-white/10 bg-white/5" />
              <div className="h-9 w-20 rounded-xl border border-white/10 bg-white/5" />
            </div>
          </div>
          <div className="h-9 w-24 rounded-xl border border-white/10 bg-white/5" />
        </div>
      </div>
    )
  }

  // If for any reason we have no email, don't render (keeps /login clean even if mounted somewhere)
  if (!email) return null

  return (
    <div className="sticky top-0 z-[6000] border-b border-white/10 bg-black/70 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="font-extrabold tracking-wide">
            RHD
          </Link>

          <div className="hidden sm:flex items-center gap-2 ml-2">
            <NavLink href="/dashboard" label="Browse" />
            <NavLink href="/offers" label="My Offers" />
            {isAdmin && <NavLink href="/admin" label="Admin" />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:block text-xs text-white/60">{email}</div>

          <button
            onClick={async () => {
              await supabase.auth.signOut()
              router.replace("/login")
            }}
            className="rounded-xl border border-white/15 px-3 py-2 text-sm hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile links */}
      <div className="sm:hidden px-4 pb-3 flex gap-2">
        <NavLink href="/dashboard" label="Browse" />
        <NavLink href="/offers" label="My Offers" />
        {isAdmin && <NavLink href="/admin" label="Admin" />}
      </div>
    </div>
  )
}
