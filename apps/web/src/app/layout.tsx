import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Conteo — Auditoría E-14 · Colombia 2026",
  description: "Auditoría ciudadana mesa por mesa de la segunda vuelta presidencial 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-[#0a0a0a]">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
