"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import dynamic from "next/dynamic"

const LoginMap = dynamic(() => import("@/components/LoginMap"), { ssr: false })

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (error) {
      setErrorMessage(error.message)
      setLoading(false)
      return
    }

    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[var(--background)]">

      {/* ── Left: map panel ───────────────────────────────────── */}
      <div className="relative hidden md:flex md:flex-1 overflow-hidden">

        {/* Live map */}
        <div className="absolute inset-0">
          <LoginMap />
        </div>

        {/* Gradient overlay — fades into the right panel edge */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#06090f]/10 via-transparent to-[#06090f]/60 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#06090f]/60 via-transparent to-transparent pointer-events-none" />

        {/* Marketing copy */}
        <div className="absolute bottom-10 left-8 right-16 pointer-events-none">

          {/* Logo mark */}
          <div className="flex items-center gap-2.5 mb-5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] shadow-lg">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            </div>
            <span className="text-white font-bold text-lg tracking-tight drop-shadow">RHD Wholesale</span>
          </div>

          <h2 className="text-3xl font-bold text-white leading-snug drop-shadow-md">
            Tennessee&apos;s Off-Market<br />Deal Pipeline
          </h2>
          <p className="mt-2 text-white/70 text-sm max-w-xs leading-relaxed">
            Exclusive access to wholesale properties before they hit the open market. Approved buyers only.
          </p>

          {/* Stat chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: "📍", label: "Multiple Counties" },
              { icon: "🔒", label: "Off-Market Only" },
              { icon: "⚡", label: "First Dibs Access" },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium text-white/90"
              >
                <span>{s.icon}</span>
                {s.label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: sign-in form ────────────────────────────────── */}
      <div className="flex flex-col items-center justify-center w-full md:w-[420px] md:flex-none min-h-screen bg-[var(--background)] px-8 py-12 relative z-10">

        {/* Mobile logo */}
        <div className="flex md:hidden items-center gap-2 mb-8">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <span className="text-[var(--text)] font-bold text-lg">RHD Wholesale</span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Approved buyers only.{" "}
              <button
                type="button"
                onClick={() => router.push("/signup")}
                className="text-[var(--accent)] hover:underline font-medium"
              >
                Request access
              </button>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {errorMessage && (
              <p className="text-sm text-[var(--danger)]">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 active:brightness-95 disabled:opacity-60 transition-all shadow-[0_2px_8px_rgba(74,144,245,0.35)]"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Divider + teaser */}
          <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--muted)] mb-2">
              What you get access to
            </p>
            <ul className="space-y-1.5">
              {[
                "Off-market wholesale properties across TN",
                "Interactive map with deal details",
                "First Dibs & VIP early access windows",
                "Submit offers directly through the platform",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px] text-[var(--muted)]">
                  <svg className="mt-0.5 shrink-0 text-[var(--accent)]" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
