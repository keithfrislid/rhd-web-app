import type { Metadata } from "next";
import "./globals.css";
import TopNav from "@/components/TopNav"

export const metadata: Metadata = {
  title: "RHD Web App",
  description: "Off-market wholesale property platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-black text-white">
          {/* Top Navigation */}
          <header className="sticky top-0 z-10 border-b border-white/10 bg-black/80 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
              <div className="text-sm font-semibold tracking-wide">
                RHD
              </div>

              <nav className="text-sm text-white/70">
                <a
                  href="/dashboard"
                  className="hover:text-white transition-colors"
                >
                  Dashboard
                </a>
              </nav>
            </div>
          </header>

          {/* Page Content */}
          <div className="mx-auto max-w-5xl px-4 py-8">
            {children}
          </div>
        </div>
      </body>
    </html>
  );
}
