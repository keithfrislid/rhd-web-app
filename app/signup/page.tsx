"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const cleanedPhone = phone.trim();

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: cleanedPhone,
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      return;
    }

    // Notify admin of new access request (best-effort, non-blocking)
    fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/notify-admin-signup`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim(),
        }),
      }
    ).catch(() => {});

    setSuccessMessage(
      "Account created. Please check your email to confirm your account, then sign in."
    );
    setLoading(false);
  };

  const inputClass =
    "mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 bg-[var(--surface-2)] text-[var(--text)] outline-none focus:border-[var(--border-strong)]";

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)] text-[var(--text)]">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm">
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Request access to RHD. All fields required.
        </p>

        <form onSubmit={handleSignup} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="text-sm font-medium">First name</label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputClass}
                placeholder="John"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Last name</label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputClass}
                placeholder="Smith"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Phone</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="(615) 555-1234"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Use at least 8 characters.
              </p>
            </div>
          </div>

          {errorMessage && (
            <p className="text-sm text-[var(--danger)]">{errorMessage}</p>
          )}

          {successMessage && (
            <p className="text-sm text-[var(--success)]">{successMessage}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--accent)] text-white px-3 py-2 font-medium hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/login")}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-medium text-[var(--text)] hover:bg-[var(--surface-2)]"
          >
            Back to sign in
          </button>
        </form>
      </div>
    </main>
  );
}