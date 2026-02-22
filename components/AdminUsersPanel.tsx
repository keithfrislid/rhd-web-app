"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type PendingUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
  role: string;
};

function shortId(id: string) {
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

export default function AdminUsersPanel() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const pending = useMemo(() => users.filter((u) => u.role === "pending"), [users]);

  const callAdminUsers = async (path: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("No session");

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-users${path}`,
      {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || `Request failed (${res.status})`);
    return json;
  };

  const load = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const json = await callAdminUsers("", { method: "GET" });
      setUsers((json.users ?? []) as PendingUser[]);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Failed to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (userId: string) => {
    if (busyId) return;
    setBusyId(userId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const json = await callAdminUsers("", {
        method: "POST",
        body: JSON.stringify({ user_id: userId }),
      });

      const approved = json?.approved as PendingUser | undefined;
      const emailSent = !!json?.email_sent;
      const emailError = json?.email_error ? String(json.email_error) : null;

      const name =
        `${approved?.first_name ?? ""} ${approved?.last_name ?? ""}`.trim() ||
        approved?.email ||
        shortId(userId);

      if (emailSent) {
        setSuccessMsg(`Approved ${name}. Approval email sent.`);
      } else if (emailError) {
        setSuccessMsg(`Approved ${name}. Email not sent (${emailError}).`);
      } else {
        setSuccessMsg(`Approved ${name}.`);
      }

      // Reload list
      await load();

      // Let Admin page re-count badge
      window.dispatchEvent(new Event("rhd:users-changed"));

      // Auto-clear success message after a few seconds
      setTimeout(() => setSuccessMsg(null), 4500);
    } catch (e: any) {
      setErrorMsg(e?.message ?? "Approve failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Approve Users</div>
          <div className="mt-0.5 text-xs text-white/60">
            Pending requests:{" "}
            <span className="text-white/80 font-semibold">{pending.length}</span>
          </div>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
        >
          Refresh
        </button>
      </div>

      {successMsg && (
        <div className="m-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div className="m-4 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="p-4 text-sm text-white/70">Loading users…</div>
      ) : pending.length === 0 ? (
        <div className="p-4 text-sm text-white/70">No pending users right now.</div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-black/30 text-xs font-semibold text-white/60">
              <tr className="border-b border-white/10">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">User ID</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-white/10">
              {pending.map((u) => {
                const fullName =
                  `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "—";

                return (
                  <tr key={u.user_id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-semibold">{fullName}</td>
                    <td className="px-4 py-3 text-white/80">{u.email ?? "—"}</td>
                    <td className="px-4 py-3 text-white/80">{u.phone ?? "—"}</td>
                    <td className="px-4 py-3 text-white/70">
                      {new Date(u.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-white/70">
                      <span className="rounded-full border border-white/15 bg-black/30 px-2 py-1 text-xs font-semibold">
                        {shortId(u.user_id)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => approve(u.user_id)}
                          disabled={busyId === u.user_id}
                          className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                            busyId === u.user_id
                              ? "border border-white/10 bg-white/5 text-white/60 cursor-not-allowed"
                              : "bg-white text-black hover:opacity-90"
                          }`}
                        >
                          {busyId === u.user_id ? "Approving…" : "Approve"}
                        </button>

                        <button
                          onClick={() => navigator.clipboard.writeText(u.user_id)}
                          className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
                        >
                          Copy ID
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="p-4 text-xs text-white/50 border-t border-white/10">
        Approving changes role from <b>pending</b> → <b>buyer</b> and attempts to send an approval email.
      </div>
    </div>
  );
}