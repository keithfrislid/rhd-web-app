import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RHD Wholesale",
  description: "Off-market wholesale property platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Anti-FOUC: apply saved theme before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('rhd-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`,
          }}
        />
      </head>
      <body className="font-[var(--font-inter)]">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
