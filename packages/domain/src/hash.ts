import { createHash } from "node:crypto";

/**
 * SHA-256 hex de un archivo binario. Se usa para sellar la evidencia
 * original al momento de la descarga/captura, de modo que cualquier
 * alteración posterior sea detectable.
 */
export function sha256Hex(data: Buffer | Uint8Array | string): string {
  return createHash("sha256").update(data).digest("hex");
}

/** Verifica que un buffer corresponda a un hash esperado. */
export function verifySha256(
  data: Buffer | Uint8Array | string,
  expectedHex: string,
): boolean {
  return sha256Hex(data).toLowerCase() === expectedHex.toLowerCase();
}
