import { config } from "../config";
import type { OcrProvider } from "./types";
import { StubOcrProvider } from "./stub-provider";

/**
 * Selecciona el proveedor de OCR según OCR_PROVIDER. Los proveedores
 * reales se enchufan aquí implementando `OcrProvider`.
 */
export function getOcrProvider(): OcrProvider {
  switch (config.ocrProvider) {
    case "stub":
      return new StubOcrProvider();
    // case "gcp-documentai": return new DocumentAiProvider();
    // case "aws-textract":   return new TextractProvider();
    // case "azure-di":       return new AzureDiProvider();
    default:
      return new StubOcrProvider();
  }
}

export * from "./types";
