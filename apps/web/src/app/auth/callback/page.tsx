"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase can redirect here with error params on failure
    const error = params.get("error_description") ?? params.get("error");
    if (error) {
      setErrorMsg(decodeURIComponent(error.replace(/\+/g, " ")));
      setTimeout(() => router.push("/login"), 4000);
      return;
    }

    // Listen for SIGNED_IN — fires once Supabase processes the OAuth code/hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          router.push("/auditar");
        }
      }
    );

    // Fallback: session already established (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        subscription.unsubscribe();
        router.push("/auditar");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, params]);

  if (errorMsg) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800 mb-2">Error al iniciar sesión</h2>
          <p className="text-sm text-red-700 mb-4">{errorMsg}</p>
          <p className="text-xs text-red-600">Redirigiendo al login en 4 segundos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center">
        <div className="w-6 h-6 border-2 border-[#0a0a0a] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#6b7280] text-sm">Iniciando sesión con Google...</p>
      </div>
    </div>
  );
}
