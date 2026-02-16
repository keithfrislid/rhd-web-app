"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";


type ViewMode = "map" | "list";

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const LeafletMap = dynamic(() => import("@/components/LeafletMap"), {
    ssr: false,
  });


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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-white/70">
            Signed in as {email ?? "unknown"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("map")}
            className={`rounded-xl px-3 py-2 text-sm border border-white/20 ${
              viewMode === "map" ? "bg-white text-black" : "hover:bg-white/10"
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`rounded-xl px-3 py-2 text-sm border border-white/20 ${
              viewMode === "list" ? "bg-white text-black" : "hover:bg-white/10"
            }`}
          >
            List
          </button>

          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/login");
            }}
            className="rounded-xl border border-white/20 px-3 py-2 text-sm hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6">
        {viewMode === "map" ? (
          <LeafletMap />
        ) : (
          <div className="rounded-2xl border border-white/10 p-4">
            <p className="text-sm text-white/70">
              List view coming next. (We’ll show property cards here.)
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
