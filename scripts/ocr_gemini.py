#!/usr/bin/env python3
"""
OCR de actas E-14 con Google Gemini Flash.

Sin costo para las primeras ~1,000 actas/día (free tier).
Costo total aprox $9-18 USD para las 121k actas completas.

Instalar:
  pip3 install google-generativeai pdf2image pillow psycopg2-binary --break-system-packages
  brew install poppler

Configurar:
  export GOOGLE_API_KEY="tu_api_key_de_google_ai_studio"
  # Obtener key gratis en: https://aistudio.google.com/app/apikey

Uso:
  python3 scripts/ocr_gemini.py run [limit]   # procesa actas con PDF descargado
  python3 scripts/ocr_gemini.py stats         # estadísticas del pipeline
  python3 scripts/ocr_gemini.py test <pdf>    # prueba un PDF específico
  python3 scripts/ocr_gemini.py download N    # solo descarga N PDFs (sin OCR)
"""
import sys
import os
import json
import time
import psycopg2
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://conteo:conteo@localhost:5432/conteo")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "")

PROMPT = """Eres un sistema de auditoría electoral. Analiza este formulario E-14 (Acta de Escrutinio de Jurados de Votación) de la segunda vuelta presidencial colombiana 2026.

Extrae con MÁXIMA PRECISIÓN los siguientes datos numéricos. Los números pueden ser manuscritos o impresos.

IMPORTANTE: Esta es una elección con solo 2 candidatos:
- Candidato 1: IVÁN CEPEDA CASTRO (fórmula vicepresidencial: AÍDA QUILCUÉ VIVAS)
- Candidato 2: ABELARDO DE LA ESPRIELLA (fórmula vicepresidencial: JOSÉ MANUEL RESTREPO)

Responde ÚNICAMENTE en este formato JSON exacto, sin texto adicional:
{
  "tipoCopia": "CLAVEROS" o "DELEGADOS" o "DESCONOCIDO",
  "mesa": número de mesa (entero),
  "zona": número de zona,
  "puesto": código o nombre del puesto de votación,
  "municipio": nombre del municipio,
  "departamento": nombre del departamento,
  "nivelacion": {
    "totalVotantesE11": número total de votantes habilitados (formulario E-11),
    "totalVotosUrna": total de votos en la urna,
    "totalVotosIncinerados": total de votos incinerados (o 0 si no aplica)
  },
  "candidatos": [
    {"nombre": "IVÁN CEPEDA CASTRO", "votos": número de votos},
    {"nombre": "ABELARDO DE LA ESPRIELLA", "votos": número de votos}
  ],
  "votosEnBlanco": número de votos en blanco,
  "votosNulos": número de votos nulos,
  "votosNoMarcados": número de votos no marcados,
  "sumaTotal": suma total (candidatos + blancos + nulos + no marcados),
  "hayEnmiendas": true si hay tachones, correcciones o números sospechosamente alterados,
  "enmiendaDetalle": descripción de las enmiendas si las hay,
  "severidadAnomalia": "NINGUNA", "BAJA", "MEDIA" o "ALTA",
  "observaciones": notas adicionales relevantes para auditoría
}

Si un número no está visible o es ilegible, usa null.
Para tipoCopia: busca la palabra CLAVEROS o DELEGADOS en el encabezado del acta."""


def get_gemini_model():
    if not GOOGLE_API_KEY:
        print("ERROR: GOOGLE_API_KEY no configurado.", file=sys.stderr)
        print("Obtén tu key gratis en: https://aistudio.google.com/app/apikey", file=sys.stderr)
        print("Luego: export GOOGLE_API_KEY='tu_key'", file=sys.stderr)
        sys.exit(1)

    import google.generativeai as genai
    genai.configure(api_key=GOOGLE_API_KEY)
    return genai.GenerativeModel("gemini-1.5-flash")


def ocr_pdf_gemini(pdf_path: str, tx_id: str, model=None) -> dict:
    """OCR un PDF de E-14 con Gemini Flash."""
    from pdf2image import convert_from_path
    import google.generativeai as genai
    from PIL import Image
    import io

    if model is None:
        model = get_gemini_model()

    # Convertir PDF a imagen (solo página 1)
    images = convert_from_path(pdf_path, dpi=200, first_page=1, last_page=1)
    if not images:
        return _empty_result(tx_id, pdf_path, "No se pudo convertir PDF a imagen")

    img = images[0]

    # Convertir a bytes para Gemini
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()

    try:
        response = model.generate_content([
            PROMPT,
            {"mime_type": "image/jpeg", "data": img_bytes},
        ])

        text = response.text.strip()

        # Limpiar posibles markdown code blocks
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()

        result = json.loads(text)

        # Normalizar campos
        result.setdefault("tipoCopia", "DESCONOCIDO")
        result.setdefault("hayEnmiendas", False)
        result.setdefault("enmiendaDetalle", "")
        result.setdefault("severidadAnomalia", "NINGUNA")
        result.setdefault("observaciones", "")
        result.setdefault("candidatos", [])
        result.setdefault("nivelacion", {})
        result["ocrEngine"] = "gemini-flash"
        result["_txId"] = tx_id
        result["_pdfPath"] = pdf_path

        # Validación aritmética
        result["_fraudFlags"] = _validar_aritmetica(result)
        sev = result.get("severidadAnomalia", "NINGUNA")
        flags = result["_fraudFlags"]
        if flags and sev == "NINGUNA":
            result["_fraudSeverity"] = "MEDIA" if len(flags) >= 2 else "BAJA"
        else:
            result["_fraudSeverity"] = sev
        result["totalSufragantes"] = result.get("nivelacion", {}).get("totalVotosUrna")

        return result

    except json.JSONDecodeError as e:
        return _empty_result(tx_id, pdf_path, f"JSON parse error: {e} | Response: {text[:200]}")
    except Exception as e:
        return _empty_result(tx_id, pdf_path, f"Gemini error: {e}")


def _validar_aritmetica(result: dict) -> list:
    flags = []
    candidatos = result.get("candidatos") or []
    suma_cands = sum(c.get("votos") or 0 for c in candidatos)
    blancos = result.get("votosEnBlanco") or 0
    nulos = result.get("votosNulos") or 0
    no_marc = result.get("votosNoMarcados") or 0
    suma_calc = suma_cands + blancos + nulos + no_marc

    suma_decl = result.get("sumaTotal")
    if suma_decl is not None and suma_calc != suma_decl:
        flags.append(f"Suma calculada {suma_calc} ≠ declarada {suma_decl} (Δ{suma_calc - suma_decl})")

    niv = result.get("nivelacion") or {}
    urna = niv.get("totalVotosUrna")
    e11 = niv.get("totalVotantesE11")
    inc = niv.get("totalVotosIncinerados")

    if urna is not None and suma_decl is not None and urna != suma_decl:
        flags.append(f"Votos urna {urna} ≠ suma total {suma_decl} (Δ{urna - suma_decl})")
    if urna is not None and e11 is not None and urna > e11:
        flags.append(f"SOBRECAPACIDAD: urna({urna}) > E-11({e11})")
    if urna is not None and inc is not None and inc > 0 and suma_cands > 0 and inc >= urna:
        flags.append(f"Incinerados implausibles: {inc} con {suma_cands} votos de candidatos")

    return flags


def _empty_result(tx_id, pdf_path, error_msg):
    return {
        "tipoCopia": "DESCONOCIDO", "mesa": None, "zona": "", "municipio": "",
        "departamento": "", "puesto": "", "nivelacion": {}, "candidatos": [],
        "votosEnBlanco": None, "votosNulos": None, "votosNoMarcados": None,
        "sumaTotal": None, "totalSufragantes": None, "hayEnmiendas": False,
        "enmiendaDetalle": "", "severidadAnomalia": "NINGUNA",
        "observaciones": error_msg, "ocrEngine": "gemini-flash",
        "_txId": tx_id, "_pdfPath": pdf_path,
        "_fraudFlags": [f"OCR error: {error_msg}"], "_fraudSeverity": "NINGUNA",
    }


def get_conn():
    return psycopg2.connect(DATABASE_URL)


def run(limit: int = 50):
    """Procesa actas con PDF descargado usando Gemini Flash."""
    conn = get_conn()
    cur = conn.cursor()

    # Buscar actas con PDF pero sin OCR de Gemini
    cur.execute("""
        SELECT id, "idTransmissionCode", "pdfPath"
        FROM "E14ActaIndex"
        WHERE status = 'downloaded' AND "pdfPath" IS NOT NULL
          AND ("ocrResult" IS NULL OR "ocrResult"->>'ocrEngine' != 'gemini-flash')
        ORDER BY "idDepartmentCode"
        LIMIT %s
    """, (limit,))
    rows = cur.fetchall()

    if not rows:
        print("No hay actas para procesar (status=downloaded con pdfPath).")
        print("Ejecuta primero: npx tsx scripts/pipeline-e14.ts download N")
        conn.close()
        return

    print(f"Procesando {len(rows)} actas con Gemini Flash...\n")
    model = get_gemini_model()
    ok = 0; errors = 0

    for row_id, tx_id, pdf_path in rows:
        if not pdf_path or not Path(pdf_path).exists():
            print(f"  [SKIP] {tx_id} — PDF no existe")
            errors += 1
            continue

        print(f"  {tx_id} ", end="", flush=True)

        result = ocr_pdf_gemini(pdf_path, tx_id, model)
        flags = result.pop("_fraudFlags", [])
        severity = result.pop("_fraudSeverity", "NINGUNA")

        cur.execute("""
            UPDATE "E14ActaIndex"
            SET status = 'ocr_done',
                "ocrResult" = %s::jsonb,
                "fraudFlags" = %s::jsonb,
                "fraudSeverity" = %s,
                "processedAt" = NOW(),
                "updatedAt" = NOW()
            WHERE id = %s
        """, (json.dumps(result), json.dumps(flags), severity, row_id))
        conn.commit()

        cepeda = next((c.get("votos") for c in result.get("candidatos", []) if "CEPEDA" in c.get("nombre", "")), "?")
        espriella = next((c.get("votos") for c in result.get("candidatos", []) if "ESPRIELLA" in c.get("nombre", "")), "?")
        flag_str = f" ⚠ {severity}" if flags else ""
        print(f"✓ {result.get('tipoCopia','?')} Mesa{result.get('mesa','?')} {result.get('municipio','')} | Cepeda:{cepeda} Espriella:{espriella}{flag_str}")
        ok += 1

        # Rate limiting: Gemini Flash free tier = 15 req/min
        time.sleep(4)

    print(f"\n=== Completado: {ok} OK, {errors} errores ===")
    cur.close(); conn.close()


def stats():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("SELECT status, COUNT(*) FROM \"E14ActaIndex\" GROUP BY status ORDER BY COUNT(*) DESC")
    print("\n=== E14 Pipeline Stats ===")
    for status, count in cur.fetchall():
        print(f"  {status:15} {count:,}")

    cur.execute("""
        SELECT "ocrResult"->>'ocrEngine' as engine, COUNT(*)
        FROM "E14ActaIndex" WHERE status='ocr_done'
        GROUP BY engine ORDER BY COUNT(*) DESC
    """)
    rows = cur.fetchall()
    if rows:
        print("\n=== OCR Engine ===")
        for engine, count in rows:
            print(f"  {(engine or 'null'):20} {count:,}")

    cur.execute("""
        SELECT "fraudSeverity", COUNT(*) FROM "E14ActaIndex"
        WHERE "fraudSeverity" IS NOT NULL AND "fraudSeverity" != 'NINGUNA'
        GROUP BY "fraudSeverity" ORDER BY COUNT(*) DESC
    """)
    rows = cur.fetchall()
    if rows:
        print("\n=== Alertas de fraude ===")
        for sev, count in rows:
            print(f"  {(sev or '?'):10} {count:,}")

    cur.close(); conn.close()


def test_pdf(pdf_path: str):
    """Test Gemini OCR en un PDF específico."""
    print(f"OCR con Gemini Flash: {pdf_path}")
    model = get_gemini_model()
    result = ocr_pdf_gemini(pdf_path, "test", model)
    flags = result.pop("_fraudFlags", [])
    severity = result.pop("_fraudSeverity", "NINGUNA")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    if flags:
        print(f"\nFLAGS [{severity}]:")
        for f in flags:
            print(f"  ⚠ {f}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    if cmd == "run":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else 50
        run(limit)
    elif cmd == "stats":
        stats()
    elif cmd == "test":
        if len(sys.argv) < 3:
            print("Uso: python3 ocr_gemini.py test <ruta-pdf>")
        else:
            test_pdf(sys.argv[2])
    else:
        print("Uso: python3 ocr_gemini.py run [limit] | stats | test <pdf>")
