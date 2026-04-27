"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TopNav from "@/components/TopNav";
import PendingApproval from "@/components/PendingApproval";

type Role = "admin" | "buyer" | "pending" | null;

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [ready, setReady] = useState(false);
  const [role, setRole] = useState<Role>(null);

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const resolveRole = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("user_id", session.user.id)
        .maybeSingle();

      let resolvedRole: Role = "pending";

      if (!error && profile) {
        if (profile.role === "admin" || profile.is_admin === true) resolvedRole = "admin";
        else if (profile.role === "buyer") resolvedRole = "buyer";
        else resolvedRole = "pending";
      }

      if (pathname.startsWith("/admin") && resolvedRole !== "admin") {
        router.replace("/dashboard");
        return;
      }

      if (!cancelled) {
        setRole(resolvedRole);
        setReady(true);
      }

      // Record a visit once per day per user (best-effort, non-blocking)
      if (resolvedRole !== "pending") {
        try {
          const today = new Date().toDateString();
          const key = `visit_${session.user.id}_${today}`;
          if (!sessionStorage.getItem(key)) {
            supabase.rpc("record_visit").then(() => {
              sessionStorage.setItem(key, "1");
            });
          }
        } catch {
          // ignore
        }
      }

      if (resolvedRole !== "pending" && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    resolveRole();
    intervalId = setInterval(resolveRole, 5000);

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  // IMPORTANT: use tokens (not hardcoded black/white) so globals.css actually shows through.
  const shellClass =
    "min-h-screen bg-[var(--background)] text-[var(--text)]";

  if (!ready) {
    return (
      <div className={shellClass}>
        <div className="p-6 text-sm text-[var(--muted)]">Loading…</div>
      </div>
    );
  }

  if (role === "pending") {
    return (
      <div className={shellClass}>
        <TopNav />
        <PendingApproval />
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}