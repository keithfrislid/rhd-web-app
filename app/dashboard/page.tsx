"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase.auth.getSession();

      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }

      setEmail(session.user.email ?? null);
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) {
    return (
      <main className="p-6">
        <p className="text-sm text-white/70">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm text-white/70">
        Signed in as {email ?? "unknown"}
      </p>

      <button
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/login");
        }}
        className="mt-4 rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
      >
        Sign out
      </button>


      <div className="mt-6 rounded-2xl border border-white/10 p-4">
        <p className="text-sm text-white/70">
          This will become the map + list view later.
        </p>
      </div>
    </main>
  );
}
