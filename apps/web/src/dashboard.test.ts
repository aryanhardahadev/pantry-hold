import { describe, expect, it } from "vitest";
import type { DashboardSnapshot } from "../../../packages/core/src/types.ts";

import { deriveDashboardView, identifierLabel } from "./dashboard";

const baseSnapshot: DashboardSnapshot = {
  inventory: [
    {
      id: "matched",
      name: "Organic Moringa Powder",
      shelf: "B-04",
      quantity: 6,
      unit: "bags",
      estimatedMealPortions: 180,
      identifiers: [],
      demoData: true,
    },
    {
      id: "same-name-different-identifiers",
      name: "Organic Moringa Powder",
      shelf: "B-05",
      quantity: 4,
      unit: "bags",
      estimatedMealPortions: 120,
      identifiers: [],
      demoData: true,
    },
  ],
  recalls: [
    {
      id: "recall-1",
      source: "openfda",
      sourceUrl: "https://api.fda.gov/food/enforcement.json",
      fetchedAt: "2026-08-08T19:22:00.000Z",
      reportDate: "20260729",
      classification: "Class I",
      status: "Ongoing",
      productDescription: "Organic Moringa Powder; Product code: GJ96",
      codeInfo: "lot: 25/08001",
      reasonForRecall: "Official record reason",
      distributionPattern: "Official record distribution",
      identifiers: [],
      rawSha256: "abc123",
    },
  ],
  matches: [
    {
      id: "match-1",
      inventoryItemId: "matched",
      recallId: "recall-1",
      status: "needs_review",
      evidence: [
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
      ],
      createdAt: "2026-08-08T19:23:00.000Z",
      updatedAt: "2026-08-08T19:23:00.000Z",
    },
  ],
  audit: [],
  latestSync: null,
  disclaimer: "Fictional demo inventory.",
};

describe("dashboard view", () => {
  it("counts only inventory with an explicit possible match", () => {
    const view = deriveDashboardView(baseSnapshot);

    expect(view.reviewItems).toBe(1);
    expect(view.reviewUnits).toBe(6);
    expect(view.reviewPortions).toBe(180);
    expect(view.activeMatches[0]?.inventory.id).toBe("matched");
  });

  it("does not count a same-name inventory item without a match", () => {
    const view = deriveDashboardView(baseSnapshot);

    expect(
      view.activeMatches.some(
        ({ inventory }) => inventory.id === "same-name-different-identifiers",
      ),
    ).toBe(false);
  });

  it("moves resolved matches out of active impact totals", () => {
    const snapshot: DashboardSnapshot = {
      ...baseSnapshot,
      matches: baseSnapshot.matches.map((match) => ({
        ...match,
        status: "resolved",
      })),
    };
    const view = deriveDashboardView(snapshot);

    expect(view.activeMatches).toHaveLength(0);
    expect(view.resolvedMatches).toHaveLength(1);
    expect(view.reviewPortions).toBe(0);
  });

  it("renders typed identifier names without implying fuzzy matching", () => {
    expect(identifierLabel("product_code")).toBe("Product code");
    expect(identifierLabel("upc")).toBe("UPC");
    expect(identifierLabel("lot")).toBe("Lot");
  });
});
