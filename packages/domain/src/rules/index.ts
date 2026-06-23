import { arithmeticRule } from "./arithmetic";
import { requiredFieldsRule } from "./required-fields";
import { amendmentsRule } from "./amendments";
import { preconteoDiffRule } from "./preconteo-diff";
import type { Rule } from "./types";

export * from "./types";
export { arithmeticRule, requiredFieldsRule, amendmentsRule, preconteoDiffRule };

/**
 * Conjunto de reglas por defecto del motor. El orden no afecta el
 * resultado (los hallazgos se agregan), pero ayuda a la lectura.
 */
export const DEFAULT_RULES: Rule[] = [
  requiredFieldsRule,
  arithmeticRule,
  amendmentsRule,
  preconteoDiffRule,
];
