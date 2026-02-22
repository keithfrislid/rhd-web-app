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

      // Fetch role from profiles
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("user_id", session.user.id)
        .maybeSingle();

      // Default safe behavior: if we can’t read role for any reason, treat as pending
      let resolvedRole: Role = "pending";

      if (!error && profile) {
        if (profile.role === "admin" || profile.is_admin === true) resolvedRole = "admin";
        else if (profile.role === "buyer") resolvedRole = "buyer";
        else resolvedRole = "pending";
      }

      // Admin route protection
      if (pathname.startsWith("/admin") && resolvedRole !== "admin") {
        router.replace("/dashboard");
        return;
      }

      if (!cancelled) {
        setRole(resolvedRole);
        setReady(true);
      }

      // If user is no longer pending, stop polling
      if (resolvedRole !== "pending" && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Initial role check
    resolveRole();

    // Poll every 5s ONLY while pending (the interval will be cleared once approved)
    intervalId = setInterval(resolveRole, 5000);

    // Keep auth state handling
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace("/login");
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
      sub.subscription.unsubscribe();
    };
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="p-6 text-sm text-white/70">Loading…</div>
      </div>
    );
  }

  // Pending users: show the pending approval screen instead of app pages
  if (role === "pending") {
    return (
      <div className="min-h-screen bg-black text-white">
        <TopNav />
        <PendingApproval />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <TopNav />
      <div className="mx-auto max-w-5xl px-4 py-6">{children}</div>
    </div>
  );
}