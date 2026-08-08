import { describe, expect, it } from "vitest";
import {
  extractExplicitIdentifiers,
  findExactIdentifierMatches,
} from "./matching.js";
import type { InventoryItem, RecallRecord } from "./types.js";

const matchingInventory: InventoryItem = {
  id: "inventory-moringa-match",
  name: "Organic Moringa Powder",
  shelf: "B-04",
  quantity: 6,
  unit: "bags",
  estimatedMealPortions: 180,
  identifiers: [
    {
      type: "product_code",
      value: "GJ96",
      displayValue: "GJ96",
      evidence: "Pantry intake label",
    },
    {
      type: "lot",
      value: "25/08001",
      displayValue: "25/08001",
      evidence: "Pantry intake label",
    },
  ],
  demoData: true,
};

function recallWithIdentifiers(
  identifiers: RecallRecord["identifiers"],
): RecallRecord {
  return {
    id: "H-1180-2026",
    source: "openfda",
    sourceUrl: "https://api.fda.gov/food/enforcement.json",
    fetchedAt: "2026-08-08T19:22:00.000Z",
    reportDate: "2026-07-29",
    classification: "Class I",
    status: "Ongoing",
    productDescription: "Organic Moringa Powder",
    codeInfo: "lot: 25/08001",
    reasonForRecall: "Official record reason",
    distributionPattern: "Official record distribution",
    identifiers,
    rawSha256: "hash",
  };
}

describe("explicit identifier extraction", () => {
  it("extracts labelled identifiers and preserves exact source excerpts", () => {
    const identifiers = extractExplicitIdentifiers({
      productDescription:
        "Organic Moringa Powder; Product code: GJ96; unrelated GJ97",
      codeInfo: "lot: 25/08001 Expiration date: 02-11-2028",
    });

    expect(identifiers).toEqual([
      {
        type: "product_code",
        value: "GJ96",
        displayValue: "GJ96",
        evidence: "Product code: GJ96",
      },
      {
        type: "lot",
        value: "25/08001",
        displayValue: "25/08001",
        evidence: "lot: 25/08001",
      },
    ]);
  });

  it("does not infer identifiers from unlabelled tokens or names", () => {
    expect(
      extractExplicitIdentifiers({
        productDescription: "Organic Moringa Powder GJ96",
        codeInfo: "25/08001",
      }),
    ).toEqual([]);
  });
});

describe("possible-match gate", () => {
  const productCode = {
    type: "product_code" as const,
    value: "GJ96",
    displayValue: "GJ96",
    evidence: "Product code: GJ96",
  };
  const lot = {
    type: "lot" as const,
    value: "25/08001",
    displayValue: "25/08001",
    evidence: "lot: 25/08001",
  };

  it("requires the exact lot and an exact product-level identifier", () => {
    expect(
      findExactIdentifierMatches(
        matchingInventory,
        recallWithIdentifiers([productCode, lot]),
      ),
    ).toEqual([
      {
        type: "product_code",
        inventoryValue: "GJ96",
        recallValue: "GJ96",
        sourceEvidence: "Product code: GJ96",
      },
      {
        type: "lot",
        inventoryValue: "25/08001",
        recallValue: "25/08001",
        sourceEvidence: "lot: 25/08001",
      },
    ]);
  });

  it.each([
    ["product code only", [productCode]],
    ["lot only", [lot]],
    ["case-different product code", [{ ...productCode, value: "gj96" }, lot]],
    ["different lot", [productCode, { ...lot, value: "25/08002" }]],
  ])("creates no evidence for %s", (_name, identifiers) => {
    expect(
      findExactIdentifierMatches(
        matchingInventory,
        recallWithIdentifiers(identifiers),
      ),
    ).toEqual([]);
  });
});
