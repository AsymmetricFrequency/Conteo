import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conteo — Auditoría E-14 · Colombia 2026",
  description: "Auditoría ciudadana mesa por mesa de la segunda vuelta presidencial 2026",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-[#0a0a0a]">
        {/* Header — white, thin border, clean */}
        <header className="bg-white border-b border-[#e5e7eb] sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-6">
            <div className="flex items-center h-14 gap-8">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2.5 shrink-0">
                <div
                  className="w-7 h-7 flex items-center justify-center text-sm font-black border border-[#0a0a0a]"
                  style={{ lineHeight: 1 }}
                >
                  C
                </div>
                <span className="font-bold text-sm tracking-tight text-[#0a0a0a]">Conteo</span>
                <span className="text-xs text-[#9ca3af] hidden sm:block">Auditoría E-14 · Colombia 2026</span>
              </Link>

              {/* Separator */}
              <div className="h-4 w-px bg-[#e5e7eb]" />

              {/* Nav */}
              <nav className="flex items-center gap-6">
                {[
                  { href: "/", label: "Inicio" },
                  { href: "/preconteo", label: "Preconteo" },
                  { href: "/e14", label: "Actas E-14" },
                  { href: "/comparacion", label: "E-14 vs Preconteo" },
                  { href: "/alertas", label: "Alertas" },
                  { href: "/auditar", label: "Auditar" },
                  { href: "/login", label: "Unirte" },
                ].map(({ href, label }) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-sm text-[#4b5563] hover:text-[#0a0a0a] transition-colors font-medium"
                  >
                    {label}
                  </Link>
                ))}
              </nav>

              {/* Right */}
              <div className="ml-auto">
                <span className="text-xs font-medium text-[#4b5563] border border-[#e5e7eb] px-3 py-1">
                  Segunda vuelta · 2026
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10">{children}</main>

        <footer className="border-t border-[#e5e7eb] mt-20">
          <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between gap-2 text-xs text-[#9ca3af]">
            <span>Conteo · Auditoría ciudadana de formularios E-14 · Colombia 2026</span>
            <span>Datos: Registraduría Nacional del Estado Civil</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
