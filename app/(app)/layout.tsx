import AuthShell from "@/components/AuthShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
