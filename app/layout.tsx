import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RHD Web App",
  description: "Off-market wholesale property platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
