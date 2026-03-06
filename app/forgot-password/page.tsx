"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">

        <div className="mb-7">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="mb-5 flex items-center gap-1.5 text-[13px] text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to sign in
          </button>
          <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">Reset password</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-[var(--text)] mb-1">
              <svg className="text-[var(--success)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Check your email
            </div>
            <p className="text-[var(--muted)]">
              We sent a password reset link to <span className="font-medium text-[var(--text)]">{email}</span>. Click the link in that email to set a new password.
            </p>
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="mt-4 w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 transition-all"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
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

            {errorMessage && (
              <p className="text-sm text-[var(--danger)]">{errorMessage}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 active:brightness-95 disabled:opacity-60 transition-all shadow-[0_2px_8px_rgba(74,144,245,0.35)]"
            >
              {loading ? "Sending\u2026" : "Send reset link"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
