"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  const navLinks = [
    { href: "/", label: "Inicio" },
    { href: "/mapa", label: "Mapa" },
    { href: "/e14", label: "Actas E-14" },
    { href: "/comparacion", label: "E-14 vs Preconteo" },
    { href: "/alertas", label: "Alertas" },
    { href: "/comunidad", label: "Comunidad" },
    { href: "/auditar", label: "Auditar" },
  ];

  return (
    <>
      <header className="bg-white border-b border-[#e5e7eb] sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center h-14 gap-6">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <div className="w-7 h-7 flex items-center justify-center text-sm font-black border border-[#0a0a0a]">
                C
              </div>
              <span className="font-bold text-sm tracking-tight">Conteo</span>
              <span className="text-xs text-[#9ca3af] hidden sm:block">Auditoría E-14 · Colombia 2026</span>
            </Link>

            <div className="h-4 w-px bg-[#e5e7eb]" />

            <nav className="flex items-center gap-5 overflow-x-auto">
              {navLinks.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm font-medium whitespace-nowrap transition-colors ${
                    pathname === href
                      ? "text-[#0a0a0a]"
                      : "text-[#6b7280] hover:text-[#0a0a0a]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-3 shrink-0">
              {loading ? (
                <div className="w-4 h-4 border border-[#d1d5db] border-t-[#6b7280] rounded-full animate-spin" />
              ) : user ? (
                <>
                  <span className="text-xs text-[#6b7280] hidden md:block">
                    {user.user_metadata?.full_name ?? user.email}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-xs border border-[#e5e7eb] px-3 py-1.5 hover:bg-[#f9fafb] transition-colors"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="text-xs bg-[#0a0a0a] text-white px-3 py-1.5 hover:bg-[#374151] transition-colors"
                >
                  Unirte
                </Link>
              )}
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
    </>
  );
}
