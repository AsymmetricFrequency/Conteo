#!/usr/bin/env python3
"""
OCR gratuito para actas E-14.

Estrategia en capas (0 tokens de Anthropic):
  1. pdfplumber  — extrae texto si el PDF tiene capa de texto (gratis)
  2. pytesseract — OCR óptico con Tesseract (gratis, open source)
  3. Fallback    — marca la acta como "requiere_revision_humana"

Instalar dependencias:
  pip install pdfplumber pytesseract Pillow pdf2image psycopg2-binary
  brew install tesseract tesseract-lang    (macOS)
  brew install poppler                     (para pdf2image)

Uso:
  python3 scripts/ocr_free.py run [limit]   # procesa actas downloaded
  python3 scripts/ocr_free.py stats         # estadísticas
  python3 scripts/ocr_free.py test <pdf>    # prueba un PDF
"""
import sys
import os
import json
import re
import psycopg2
from pathlib import Path

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql://conteo:conteo@localhost:5432/conteo")

# ── Patrones para extraer números del E-14 ────────────────────────────────────

PATRON_MESA        = re.compile(r"MESA[:\s]+(\d+)", re.IGNORECASE)
PATRON_ZONA        = re.compile(r"ZONA[:\s]+(\d+)", re.IGNORECASE)
PATRON_MUNICIPIO   = re.compile(r"MUNICIPIO[:\s]+([A-ZÁÉÍÓÚÑ\s\-\.]+?)(?:\n|ZONA|DEPARTAMENTO)", re.IGNORECASE)
PATRON_DEPARTAMENTO= re.compile(r"DEPARTAMENTO[:\s]+([A-ZÁÉÍÓÚÑ\s\-\.]+?)(?:\n|MUNICIPIO)", re.IGNORECASE)
PATRON_E11         = re.compile(r"TOTAL\s+VOTANTES\s+FORMULARIO\s+E.?11[:\s]+(\d+)", re.IGNORECASE)
PATRON_URNA        = re.compile(r"TOTAL\s+VOTOS\s+EN\s+LA\s+URNA[:\s]+(\d+)", re.IGNORECASE)
PATRON_INCINERADOS = re.compile(r"TOTAL\s+VOTOS\s+INCINERADOS[:\s]+(\d+)", re.IGNORECASE)
PATRON_BLANCOS     = re.compile(r"VOTOS\s+EN\s+BLANCO[:\s]+(\d+)", re.IGNORECASE)
PATRON_NULOS       = re.compile(r"VOTOS\s+NULOS[:\s]+(\d+)", re.IGNORECASE)
PATRON_NO_MARCADOS = re.compile(r"VOTOS\s+NO\s+MARCADOS[:\s]+(\d+)", re.IGNORECASE)
PATRON_SUMA_TOTAL  = re.compile(r"SUMA\s+TOTAL[:\s]+(\d+)", re.IGNORECASE)
PATRON_CLAVEROS    = re.compile(r"\bCLAVEROS\b", re.IGNORECASE)
PATRON_DELEGADOS   = re.compile(r"\bDELEGADOS\b", re.IGNORECASE)

# Candidatos conocidos 2026
CANDIDATOS_CONOCIDOS = [
    ("IVÁN CEPEDA CASTRO",          "CEPEDA"),
    ("ABELARDO DE LA ESPRIELLA",    "ESPRIELLA"),
]


def extraer_numero(texto: str, patron: re.Pattern) -> int | None:
    m = patron.search(texto)
    return int(m.group(1)) if m else None


def extraer_texto_pdfplumber(pdf_path: str) -> str | None:
    """Intenta extraer texto de la capa de texto del PDF. Gratis."""
    try:
        import pdfplumber
        with pdfplumber.open(pdf_path) as pdf:
            paginas = [p.extract_text() or "" for p in pdf.pages]
            texto = "\n".join(paginas)
            if len(texto.strip()) > 50:  # tiene contenido real
                return texto
    except ImportError:
        pass
    except Exception as e:
        print(f"  pdfplumber error: {e}", file=sys.stderr)
    return None


def extraer_texto_tesseract(pdf_path: str) -> str | None:
    """OCR con Tesseract. Gratis, requiere instalación."""
    try:
        from pdf2image import convert_from_path
        import pytesseract
        images = convert_from_path(pdf_path, dpi=300, first_page=1, last_page=2)
        texto = ""
        for img in images:
            texto += pytesseract.image_to_string(img, lang="spa", config="--psm 6") + "\n"
        if len(texto.strip()) > 50:
            return texto
    except ImportError:
        pass
    except Exception as e:
        print(f"  tesseract error: {e}", file=sys.stderr)
    return None


def parsear_texto(texto: str, tx_id: str, pdf_path: str) -> dict:
    """Parsea el texto extraído del E-14 y construye el resultado."""
    tipo_copia = (
        "CLAVEROS" if PATRON_CLAVEROS.search(texto) else
        "DELEGADOS" if PATRON_DELEGADOS.search(texto) else
        "DESCONOCIDO"
    )

    # Buscar votos de candidatos conocidos
    candidatos = []
    for nombre_completo, clave in CANDIDATOS_CONOCIDOS:
        # Busca el nombre en el texto y el número en la misma línea o la siguiente
        patron_cand = re.compile(
            rf"{re.escape(clave)}[A-ZÁÉÍÓÚÑ\s/]*[:\s]+(\d+)|(\d+)\s*{re.escape(clave)}",
            re.IGNORECASE
        )
        m = patron_cand.search(texto)
        votos = int(m.group(1) or m.group(2)) if m else None
        candidatos.append({"nombre": nombre_completo, "votos": votos})

    nivelacion = {
        "totalVotantesE11":    extraer_numero(texto, PATRON_E11),
        "totalVotosUrna":      extraer_numero(texto, PATRON_URNA),
        "totalVotosIncinerados": extraer_numero(texto, PATRON_INCINERADOS),
    }

    result = {
        "tipoCopia":       tipo_copia,
        "mesa":            extraer_numero(texto, PATRON_MESA),
        "zona":            str(extraer_numero(texto, PATRON_ZONA) or ""),
        "municipio":       (PATRON_MUNICIPIO.search(texto) or [None, ""])[1].strip()[:40] if PATRON_MUNICIPIO.search(texto) else "",
        "departamento":    (PATRON_DEPARTAMENTO.search(texto) or [None, ""])[1].strip()[:40] if PATRON_DEPARTAMENTO.search(texto) else "",
        "nivelacion":      nivelacion,
        "candidatos":      candidatos,
        "votosEnBlanco":   extraer_numero(texto, PATRON_BLANCOS),
        "votosNulos":      extraer_numero(texto, PATRON_NULOS),
        "votosNoMarcados": extraer_numero(texto, PATRON_NO_MARCADOS),
        "sumaTotal":       extraer_numero(texto, PATRON_SUMA_TOTAL),
        "totalSufragantes": nivelacion["totalVotosUrna"],
        "hayEnmiendas":    False,
        "enmiendaDetalle": "",
        "severidadAnomalia": "NINGUNA",
        "observaciones":   "",
        "ocrEngine":       "pdfplumber+regex",
        "_txId":           tx_id,
        "_pdfPath":        pdf_path,
    }

    # Validación aritmética inmediata
    c0 = candidatos[0]["votos"] or 0
    c1 = candidatos[1]["votos"] or 0
    blancos = result["votosEnBlanco"] or 0
    nulos = result["votosNulos"] or 0
    no_marc = result["votosNoMarcados"] or 0
    suma_calc = c0 + c1 + blancos + nulos + no_marc

    flags = []
    if result["sumaTotal"] is not None and suma_calc != result["sumaTotal"]:
        flags.append(f"Suma calculada {suma_calc} ≠ declarada {result['sumaTotal']}")

    urna = nivelacion["totalVotosUrna"]
    e11  = nivelacion["totalVotantesE11"]
    inc  = nivelacion["totalVotosIncinerados"]

    if urna and e11 and urna > e11:
        flags.append(f"SOBRECAPACIDAD: urna({urna}) > E-11({e11})")
    if urna and result["sumaTotal"] and urna != result["sumaTotal"]:
        flags.append(f"Urna({urna}) ≠ sumaTotal({result['sumaTotal']})")
    if inc and inc > 0 and urna and inc >= urna and (c0 + c1) > 0:
        flags.append(f"Incinerados implausibles: {inc} con {c0+c1} votos de candidatos")

    result["_fraudFlags"] = flags
    result["_fraudSeverity"] = "ALTA" if len(flags) >= 2 else "MEDIA" if flags else "NINGUNA"

    return result


def procesar_pdf(pdf_path: str, tx_id: str) -> dict | None:
    """Procesa un PDF: primero pdfplumber, luego Tesseract."""
    texto = extraer_texto_pdfplumber(pdf_path)
    engine = "pdfplumber"

    if texto is None:
        print("  → sin capa de texto, probando Tesseract...", end=" ", file=sys.stderr)
        texto = extraer_texto_tesseract(pdf_path)
        engine = "tesseract"

    if texto is None:
        return {
            "tipoCopia": "DESCONOCIDO", "mesa": None, "zona": "", "municipio": "",
            "departamento": "", "nivelacion": {}, "candidatos": [],
            "votosEnBlanco": None, "votosNulos": None, "votosNoMarcados": None,
            "sumaTotal": None, "totalSufragantes": None,
            "hayEnmiendas": False, "enmiendaDetalle": "",
            "severidadAnomalia": "NINGUNA", "observaciones": "OCR fallido - requiere revisión humana",
            "ocrEngine": "failed", "_txId": tx_id, "_pdfPath": pdf_path,
            "_fraudFlags": ["OCR fallido - no se pudo extraer texto"],
            "_fraudSeverity": "NINGUNA",
        }

    result = parsear_texto(texto, tx_id, pdf_path)
    result["ocrEngine"] = engine
    return result


# ── Base de datos ────────────────────────────────────────────────────────────

def get_conn():
    return psycopg2.connect(DATABASE_URL)


def run(limit: int = 50):
    """Procesa actas en estado 'downloaded' que no tienen OCR todavía."""
    conn = get_conn()
    cur = conn.cursor()

    cur.execute("""
        SELECT id, "idTransmissionCode", "pdfPath", "sourceUrl"
        FROM "E14ActaIndex"
        WHERE status = 'downloaded' AND "pdfPath" IS NOT NULL
          AND ("ocrResult" IS NULL OR "ocrResult"->>'ocrEngine' IS NULL)
        ORDER BY "idDepartmentCode"
        LIMIT %s
    """, (limit,))
    rows = cur.fetchall()

    if not rows:
        print("No hay actas para procesar.")
        conn.close()
        return

    print(f"Procesando {len(rows)} actas con OCR gratuito...\n")
    ok = 0; errors = 0

    for row_id, tx_id, pdf_path, source_url in rows:
        if not pdf_path or not Path(pdf_path).exists():
            print(f"  [SKIP] {tx_id} — PDF no existe en {pdf_path}")
            errors += 1
            continue

        print(f"  {tx_id} ", end="", flush=True)
        result = procesar_pdf(pdf_path, tx_id)
        if result is None:
            errors += 1
            print("✗")
            continue

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

        cepeda = next((c["votos"] for c in result["candidatos"] if "CEPEDA" in c["nombre"]), "?")
        espriella = next((c["votos"] for c in result["candidatos"] if "ESPRIELLA" in c["nombre"]), "?")
        flag_str = f" ⚠ {severity}" if flags else ""
        print(f"✓ {result['tipoCopia']} Mesa{result['mesa']} {result['municipio']} | Cepeda:{cepeda} Espriella:{espriella}{flag_str}")
        ok += 1

    print(f"\n=== Completado: {ok} OK, {errors} errores ===")
    cur.close(); conn.close()


def stats():
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("""
        SELECT status, COUNT(*) FROM "E14ActaIndex" GROUP BY status ORDER BY COUNT(*) DESC
    """)
    rows = cur.fetchall()
    print("\n=== E14 Stats ===")
    for status, count in rows:
        print(f"  {status:15} {count:,}")

    cur.execute("""
        SELECT "fraudSeverity", COUNT(*) FROM "E14ActaIndex"
        WHERE "fraudSeverity" IS NOT NULL
        GROUP BY "fraudSeverity" ORDER BY COUNT(*) DESC
    """)
    rows = cur.fetchall()
    if rows:
        print("\n=== Por severidad de fraude ===")
        for sev, count in rows:
            print(f"  {(sev or 'null'):10} {count:,}")

    cur.close(); conn.close()


def test_pdf(pdf_path: str):
    result = procesar_pdf(pdf_path, "test")
    if result:
        flags = result.pop("_fraudFlags", [])
        print(json.dumps(result, indent=2, ensure_ascii=False))
        if flags:
            print(f"\nFLAGS DE FRAUDE:")
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
        test_pdf(sys.argv[2])
    else:
        print("Uso: python3 ocr_free.py run [limit] | stats | test <pdf>")
