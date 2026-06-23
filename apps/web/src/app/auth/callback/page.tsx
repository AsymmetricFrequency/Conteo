"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        localStorage.setItem("conteo_token", session.access_token);
        localStorage.setItem("conteo_user", JSON.stringify({
          email: session.user.email,
          name: session.user.user_metadata?.full_name ?? session.user.email?.split("@")[0] ?? "Auditor",
          actasAuditadas: 0,
        }));
        router.push("/auditar");
      } else {
        router.push("/login");
      }
    });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-[#6b7280] text-sm">Iniciando sesión...</p>
    </div>
  );
}
