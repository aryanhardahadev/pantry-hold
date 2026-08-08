import type {
  InventoryItem,
  MatchEvidence,
  RecallRecord,
  TypedIdentifier,
} from "./types.js";

interface LabelPattern {
  type: TypedIdentifier["type"];
  label: RegExp;
  value: RegExp;
}

const labelPatterns: LabelPattern[] = [
  {
    type: "product_code",
    label: /\bproduct\s+code\s*:\s*/gi,
    value: /^[A-Za-z0-9][A-Za-z0-9._/-]*/,
  },
  {
    type: "upc",
    label: /\bupc(?:\s+(?:code|number|no\.?))?\s*:\s*/gi,
    value: /^[0-9][0-9-]{6,18}[0-9]/,
  },
  {
    type: "lot",
    label: /\blot(?:\s+(?:code|number|no\.?))?\s*:\s*/gi,
    value: /^[A-Za-z0-9][A-Za-z0-9._/-]*/,
  },
];

/**
 * Extracts only identifiers that are introduced by an explicit supported label.
 * Product names and unlabelled look-alike tokens are intentionally ignored.
 */
export function extractExplicitIdentifiers(fields: {
  productDescription: string;
  codeInfo: string;
}): TypedIdentifier[] {
  const sources = [fields.productDescription, fields.codeInfo];
  const identifiers: TypedIdentifier[] = [];
  const seen = new Set<string>();

  for (const text of sources) {
    for (const pattern of labelPatterns) {
      pattern.label.lastIndex = 0;
      for (const labelMatch of text.matchAll(pattern.label)) {
        const labelIndex = labelMatch.index;
        if (labelIndex === undefined) {
          continue;
        }

        const valueStart = labelIndex + labelMatch[0].length;
        const valueMatch = text.slice(valueStart).match(pattern.value);
        const value = valueMatch?.[0];
        if (!value) {
          continue;
        }

        const key = `${pattern.type}\u0000${value}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);

        identifiers.push({
          type: pattern.type,
          value,
          displayValue: value,
          evidence: `${labelMatch[0]}${value}`,
        });
      }
    }
  }

  return identifiers;
}

/**
 * Returns evidence only when both the identifier type and value are identical,
 * and only when the item shares a lot plus a product-level code (product code or
 * UPC). A recall with only one class of identifier is persisted but cannot make a
 * possible match. No case folding, punctuation removal, substring, or
 * product-name matching occurs.
 */
export function findExactIdentifierMatches(
  inventoryItem: InventoryItem,
  recall: RecallRecord,
): MatchEvidence[] {
  const evidence: MatchEvidence[] = [];
  const seen = new Set<string>();

  for (const inventoryIdentifier of inventoryItem.identifiers) {
    for (const recallIdentifier of recall.identifiers) {
      if (
        inventoryIdentifier.type !== recallIdentifier.type ||
        inventoryIdentifier.value !== recallIdentifier.value
      ) {
        continue;
      }

      const key = `${inventoryIdentifier.type}\u0000${inventoryIdentifier.value}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      evidence.push({
        type: inventoryIdentifier.type,
        inventoryValue: inventoryIdentifier.value,
        recallValue: recallIdentifier.value,
        sourceEvidence: recallIdentifier.evidence,
      });
    }
  }

  const hasLot = evidence.some((item) => item.type === "lot");
  const hasProductLevelIdentifier = evidence.some(
    (item) => item.type === "product_code" || item.type === "upc",
  );

  return hasLot && hasProductLevelIdentifier ? evidence : [];
}
