/**
 * OCR de actas E-14 usando Claude Vision.
 *
 * Lee el PDF de un acta, lo envía a Claude como documento base64 y extrae:
 * - votos por candidato
 * - votos nulos, blancos, total sufragantes
 * - datos de la mesa (mesa, puesto, zona, municipio, departamento)
 *
 * Uso:
 *   npx tsx scripts/ocr-e14.ts <pdf-path>           # un PDF
 *   npx tsx scripts/ocr-e14.ts --batch /tmp/e14-pdfs --limit 5
 */
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) throw new Error("Falta ANTHROPIC_API_KEY en el entorno");

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

const E14_PROMPT = `
Eres un experto forense en auditoría electoral colombiana. Se te presenta el formulario oficial
E-14 (Acta de Escrutinio de Mesa de Votación) de la segunda vuelta presidencial de Colombia 2026.

TAREA: Extrae toda la información estructurada Y realiza un análisis forense visual de anomalías.

═══ SECCIÓN 1: TIPO DE COPIA ═══
El encabezado del formulario tiene una franja que dice "CLAVEROS" (jurados de votación) o
"DELEGADOS" (delegados de campaña). Identifica cuál es.

═══ SECCIÓN 2: DATOS DE LA MESA ═══
Departamento, municipio, zona, puesto, número de mesa.

═══ SECCIÓN 3: NIVELACIÓN DE LA MESA (cuadro superior del formulario) ═══
Extrae exactamente:
- TOTAL VOTANTES FORMULARIO E-11 (votantes habilitados)
- TOTAL VOTOS EN LA URNA (votos físicamente depositados)
- TOTAL VOTOS INCINERADOS (si aparece)

═══ SECCIÓN 4: VOTOS POR CANDIDATO ═══
Para cada candidato: nombre completo y número de votos. Lee exactamente lo escrito.

═══ SECCIÓN 5: TOTALES INFERIORES ═══
- VOTOS EN BLANCO
- VOTOS NULOS
- VOTOS NO MARCADOS
- SUMA TOTAL (CANDIDATOS + EN BLANCO + NULOS + NO MARCADOS)

═══ SECCIÓN 6: ANÁLISIS FORENSE VISUAL ═══
Examina MINUCIOSAMENTE los números escritos a mano buscando:
a) Números sobreescritos o escritos encima de otro número borrado
b) Diferencias en grosor de trazo, tipo de bolígrafo o tinta entre los campos de votos
c) Números que visualmente "no encajan" con el resto de la escritura (tamaño, inclinación, presión)
d) Borrones, tachaduras o correcciones en las celdas de votos de candidatos
e) Inconsistencia entre los dígitos de un mismo número (p.ej. primer dígito de diferente trazo)

Sé MUY específico: indica en qué celda exacta ves la anomalía y por qué es sospechosa.

Responde ÚNICAMENTE con JSON válido con esta estructura exacta:
{
  "tipoCopia": "CLAVEROS" | "DELEGADOS" | "DESCONOCIDO",
  "mesa": número_o_null,
  "puesto": "nombre del puesto",
  "zona": "código de zona",
  "municipio": "nombre",
  "departamento": "nombre",
  "nivelacion": {
    "totalVotantesE11": número_o_null,
    "totalVotosUrna": número_o_null,
    "totalVotosIncinerados": número_o_null
  },
  "candidatos": [
    { "nombre": "NOMBRE COMPLETO", "votos": número_o_null }
  ],
  "votosEnBlanco": número_o_null,
  "votosNulos": número_o_null,
  "votosNoMarcados": número_o_null,
  "sumaTotal": número_o_null,
  "totalSufragantes": número_o_null,
  "hayEnmiendas": true | false,
  "enmiendaDetalle": "descripción específica de qué campo parece alterado y por qué",
  "severidadAnomalia": "NINGUNA" | "BAJA" | "MEDIA" | "ALTA",
  "observaciones": "otras observaciones relevantes"
}

IMPORTANTE: hayEnmiendas=true solo si hay evidencia VISUAL CONCRETA de alteración (no solo irregularidades de forma). severidadAnomalia="ALTA" solo si los números de candidatos parecen claramente reescritos.
Si un número no es legible, usa null. No inventes datos.
`.trim();

interface E14Result {
  tipoCopia: "CLAVEROS" | "DELEGADOS" | "DESCONOCIDO";
  mesa: number | null;
  puesto: string;
  zona: string;
  municipio: string;
  departamento: string;
  nivelacion: {
    totalVotantesE11: number | null;
    totalVotosUrna: number | null;
    totalVotosIncinerados: number | null;
  };
  candidatos: Array<{ nombre: string; votos: number | null }>;
  votosEnBlanco: number | null;
  votosNulos: number | null;
  votosNoMarcados: number | null;
  sumaTotal: number | null;
  totalSufragantes: number | null;
  hayEnmiendas: boolean;
  enmiendaDetalle: string;
  severidadAnomalia: "NINGUNA" | "BAJA" | "MEDIA" | "ALTA";
  observaciones: string;
  // metadata
  _pdfPath?: string;
  _txId?: string;
  _error?: string;
}

export async function ocrE14(pdfPath: string, txId?: string): Promise<E14Result> {
  const pdfBytes = fs.readFileSync(pdfPath);
  const base64 = pdfBytes.toString("base64");

  let jsonStr = "";
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: E14_PROMPT,
            },
          ],
        },
      ],
    });

    const text = msg.content.find(c => c.type === "text")?.text ?? "";
    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`No JSON in response: ${text.slice(0, 200)}`);
    jsonStr = jsonMatch[0];
    const result = JSON.parse(jsonStr) as E14Result;
    result._pdfPath = pdfPath;
    result._txId = txId;
    return result;
  } catch (e) {
    return {
      tipoCopia: "DESCONOCIDO",
      mesa: null, puesto: "", zona: "", municipio: "", departamento: "",
      nivelacion: { totalVotantesE11: null, totalVotosUrna: null, totalVotosIncinerados: null },
      candidatos: [], votosEnBlanco: null, votosNulos: null, votosNoMarcados: null,
      sumaTotal: null, totalSufragantes: null,
      hayEnmiendas: false, enmiendaDetalle: "", severidadAnomalia: "NINGUNA",
      observaciones: "",
      _pdfPath: pdfPath, _txId: txId,
      _error: String(e) + (jsonStr ? ` | json: ${jsonStr.slice(0, 100)}` : ""),
    };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--batch") {
    // Batch mode
    const dir = args[1] ?? "/tmp/e14-pdfs";
    const limit = parseInt(args[args.indexOf("--limit") + 1] ?? "5");
    const outFile = args[args.indexOf("--out") + 1] ?? "/tmp/e14-ocr-results.jsonl";

    const pdfs = fs.readdirSync(dir).filter(f => f.endsWith(".pdf")).slice(0, limit);
    console.log(`Procesando ${pdfs.length} PDFs con Claude Vision...`);

    let ok = 0, errors = 0;
    for (const fname of pdfs) {
      const pdfPath = path.join(dir, fname);
      const txId = fname.replace(".pdf", "");
      process.stdout.write(`  ${fname}... `);

      const result = await ocrE14(pdfPath, txId);

      if (result._error) {
        errors++;
        console.log(`✗ ${result._error.slice(0, 80)}`);
      } else {
        ok++;
        const candidatos = result.candidatos.map(c => `${c.nombre.split(" ")[0]}:${c.votos}`).join(", ");
        console.log(`✓ Mesa${result.mesa} ${result.municipio} | ${candidatos} | nulos=${result.votosNulos}`);
      }

      fs.appendFileSync(outFile, JSON.stringify(result) + "\n");
    }

    console.log(`\nResultados: ${ok} OK, ${errors} errores → ${outFile}`);
  } else {
    // Single PDF mode
    const pdfPath = args[0];
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      console.error(`Uso: npx tsx scripts/ocr-e14.ts <pdf-path>`);
      console.error(`     npx tsx scripts/ocr-e14.ts --batch /tmp/e14-pdfs --limit 5`);
      process.exit(1);
    }

    console.log(`Procesando: ${pdfPath}`);
    const result = await ocrE14(pdfPath);

    if (result._error) {
      console.error("Error:", result._error);
      process.exit(1);
    }

    console.log("\n=== RESULTADO E-14 ===");
    console.log(`Mesa:        ${result.mesa}`);
    console.log(`Puesto:      ${result.puesto}`);
    console.log(`Zona:        ${result.zona}`);
    console.log(`Municipio:   ${result.municipio}`);
    console.log(`Departamento: ${result.departamento}`);
    console.log(`\nVotos por candidato:`);
    result.candidatos.forEach(c => {
      console.log(`  ${c.nombre.padEnd(40)} ${c.votos}`);
    });
    console.log(`\nVotos en blanco:  ${result.votosEnBlanco}`);
    console.log(`Votos nulos:      ${result.votosNulos}`);
    console.log(`Total sufragantes: ${result.totalSufragantes}`);
    if (result.observaciones) {
      console.log(`\nObservaciones: ${result.observaciones}`);
    }

    console.log("\nJSON completo:");
    console.log(JSON.stringify(result, null, 2));
  }
}

// Only run main when called directly, not when imported
const isMain = process.argv[1]?.endsWith("ocr-e14.ts") || process.argv[1]?.endsWith("ocr-e14.js");
if (isMain) {
  main().catch(e => { console.error(e); process.exit(1); });
}
