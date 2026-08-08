import type {
  DashboardSnapshot,
  InventoryItem,
  PossibleMatch,
  RecallRecord,
} from "../../../packages/core/src/types.ts";

export interface MatchDetail {
  match: PossibleMatch;
  inventory: InventoryItem;
  recall: RecallRecord;
}

export interface DashboardView {
  activeMatches: MatchDetail[];
  resolvedMatches: MatchDetail[];
  affectedItems: number;
  affectedUnits: number;
  affectedPortions: number;
}

export function deriveDashboardView(
  snapshot: DashboardSnapshot,
): DashboardView {
  const inventoryById = new Map(
    snapshot.inventory.map((item) => [item.id, item]),
  );
  const recallsById = new Map(
    snapshot.recalls.map((recall) => [recall.id, recall]),
  );

  const details = snapshot.matches.flatMap((match) => {
    const inventory = inventoryById.get(match.inventoryItemId);
    const recall = recallsById.get(match.recallId);

    return inventory && recall ? [{ match, inventory, recall }] : [];
  });
  const activeMatches = details.filter(
    ({ match }) => match.status !== "resolved",
  );
  const affectedInventory = Array.from(
    new Map(
      activeMatches.map(({ inventory }) => [inventory.id, inventory]),
    ).values(),
  );

  return {
    activeMatches,
    resolvedMatches: details.filter(({ match }) => match.status === "resolved"),
    affectedItems: affectedInventory.length,
    affectedUnits: affectedInventory.reduce(
      (total, item) => total + item.quantity,
      0,
    ),
    affectedPortions: affectedInventory.reduce(
      (total, item) => total + item.estimatedMealPortions,
      0,
    ),
  };
}

export function identifierLabel(type: string): string {
  if (type === "product_code") return "Product code";
  if (type === "upc") return "UPC";
  if (type === "lot") return "Lot";
  return type;
}
