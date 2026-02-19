"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { isCurrentUserAdmin } from "@/lib/admin"

function NavLink({
  href,
  label,
}: {
  href: string
  label: string
}) {
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
  const [email, setEmail] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      setEmail(session?.user?.email ?? null)

      if (!session) {
        setIsAdmin(false)
        return
      }

      const admin = await isCurrentUserAdmin()
      setIsAdmin(admin)
    }

    run()

    // keep it in sync with auth changes
    const { data: sub } = supabase.auth.onAuthStateChange(() => run())
    return () => {
      sub.subscription.unsubscribe()
    }
  }, [])

  // Only show nav when logged in (keeps /login clean)
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
          <div className="hidden md:block text-xs text-white/60">
            {email}
          </div>

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
