/**
 * Ingesta el JSONL del crawler de preconteo al API.
 *
 * Uso:
 *   pnpm tsx scripts/ingest-preconteo.ts [jsonl-file] [--api http://localhost:3001/api]
 *
 * Espera que el API esté corriendo (pnpm --filter @conteo/api dev).
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

const args = process.argv.slice(2);
const file = args[0] ?? "/tmp/preconteo-completo.jsonl";
const apiIdx = args.indexOf("--api");
const apiUrl = apiIdx >= 0 ? args[apiIdx + 1] : "http://localhost:3001/api";

const endpoint = `${apiUrl}/preconteo`;

async function main() {
  console.log(`Ingesting ${file} → ${endpoint}`);

  const rl = createInterface({
    input: createReadStream(file),
    crlfDelay: Infinity,
  });

  let total = 0;
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }

    // Saltar la línea de meta
    if ("meta" in data) continue;

    total++;
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        const body = (await res.json()) as { created?: boolean };
        if (body.created) {
          created++;
          if (created % 50 === 0) {
            process.stdout.write(`  ${created} ingested...\r`);
          }
        } else {
          skipped++;
        }
      } else {
        errors++;
        const text = await res.text();
        console.error(`  ✗ ${(data as {code?: string}).code}: ${res.status} ${text.slice(0, 100)}`);
      }
    } catch (e) {
      errors++;
      console.error(`  ✗ ${(data as {code?: string}).code}: ${e}`);
    }
  }

  console.log(`\nCompletado: ${total} líneas, ${created} creadas, ${skipped} saltadas, ${errors} errores`);
}

main().catch((e) => { console.error(e); process.exit(1); });
