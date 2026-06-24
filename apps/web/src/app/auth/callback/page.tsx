"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface DebugInfo {
  error?: string | null;
  errorCode?: string | null;
  errorDescription?: string | null;
  code?: string | null;
  allParams: Record<string, string>;
}

export default function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [errorMsg, setErrorMsg] = useState("");
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  useEffect(() => {
    // Capture all URL params for debugging
    const allParams: Record<string, string> = {};
    params.forEach((value, key) => { allParams[key] = value; });

    const error = params.get("error");
    const errorCode = params.get("error_code");
    const errorDescription = params.get("error_description");
    const code = params.get("code");

    const info: DebugInfo = { error, errorCode, errorDescription, code, allParams };
    setDebugInfo(info);

    // Log everything to console for developer debugging
    console.group("[Auth Callback] URL params received");
    console.log("All params:", allParams);
    console.log("error:", error);
    console.log("error_code:", errorCode);
    console.log("error_description:", errorDescription);
    console.log("code (session code present):", !!code);
    console.groupEnd();

    if (error) {
      const msg = errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : decodeURIComponent((error ?? "").replace(/\+/g, " "));
      console.error("[Auth Callback] OAuth error:", { error, errorCode, msg });
      setErrorMsg(msg);
      setTimeout(() => router.push("/login"), 8000);
      return;
    }

    // Listen for SIGNED_IN — fires once Supabase processes the OAuth code/hash
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("[Auth Callback] onAuthStateChange:", event, session ? `user=${session.user.email}` : "no session");
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          router.push("/auditar");
        }
      }
    );

    // Fallback: session already established (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      console.log("[Auth Callback] getSession:", session ? `user=${session.user.email}` : "no session", sessionError ?? "");
      if (session) {
        subscription.unsubscribe();
        router.push("/auditar");
      }
    });

    return () => subscription.unsubscribe();
  }, [router, params]);

  if (errorMsg) {
    return (
      <div className="max-w-lg mx-auto mt-16 space-y-3">
        <div className="border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800 mb-2">Error al iniciar sesión</h2>
          <p className="text-sm text-red-700 mb-1">{errorMsg}</p>
          {debugInfo?.errorCode && (
            <p className="text-xs text-red-600 font-mono mb-3">code: {debugInfo.errorCode}</p>
          )}
          <p className="text-xs text-red-500">Redirigiendo al login en 8 segundos... (abre la consola del navegador para ver el error completo)</p>
        </div>
        <details className="border border-[#e5e7eb] text-xs">
          <summary className="px-3 py-2 cursor-pointer font-mono text-[#6b7280] select-none">Debug info (para reportar el error)</summary>
          <pre className="px-3 py-2 bg-[#f9fafb] overflow-auto text-[#374151] whitespace-pre-wrap">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
          <button
            onClick={() => navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))}
            className="mx-3 mb-3 text-xs border border-[#e5e7eb] px-3 py-1 hover:bg-[#f3f4f6]"
          >
            Copiar debug info
          </button>
        </details>
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
