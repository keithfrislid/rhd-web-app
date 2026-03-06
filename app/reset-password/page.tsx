"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the user arrives via the reset link
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setErrorMessage("Passwords do not match.")
      return
    }
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.")
      return
    }

    setLoading(true)
    setErrorMessage(null)

    const { error } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setDone(true)
    setTimeout(() => router.push("/dashboard"), 2000)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-sm">

        <div className="mb-7">
          <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">Set new password</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Choose a new password for your account.
          </p>
        </div>

        {done ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm">
            <div className="flex items-center gap-2 font-semibold text-[var(--text)] mb-1">
              <svg className="text-[var(--success)]" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Password updated
            </div>
            <p className="text-[var(--muted)]">Redirecting you to the dashboard&hellip;</p>
          </div>
        ) : !ready ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 text-sm text-[var(--muted)]">
            Verifying reset link&hellip;
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                New password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted)] outline-none focus:border-[var(--accent)]/50 transition-colors"
                placeholder="At least 8 characters"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium text-[var(--text)] mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
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
              {loading ? "Updating\u2026" : "Update password"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
