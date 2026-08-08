export type IdentifierType = "product_code" | "upc" | "lot";

export interface TypedIdentifier {
  type: IdentifierType;
  value: string;
  displayValue: string;
  evidence: string;
}

export interface RecallRecord {
  id: string;
  source: "openfda";
  sourceUrl: string;
  fetchedAt: string;
  reportDate: string;
  classification: string;
  status: string;
  productDescription: string;
  codeInfo: string;
  reasonForRecall: string;
  distributionPattern: string;
  identifiers: TypedIdentifier[];
  rawSha256: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  shelf: string;
  quantity: number;
  unit: string;
  estimatedMealPortions: number;
  identifiers: TypedIdentifier[];
  demoData: true;
}

export type MatchStatus = "needs_review" | "on_hold" | "resolved";

export interface MatchEvidence {
  type: IdentifierType;
  inventoryValue: string;
  recallValue: string;
  sourceEvidence: string;
}

export interface PossibleMatch {
  id: string;
  inventoryItemId: string;
  recallId: string;
  status: MatchStatus;
  evidence: MatchEvidence[];
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  matchId: string;
  action: "match_created" | "placed_on_hold" | "resolved";
  note: string;
  createdAt: string;
}

export interface SyncRun {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  sourceMode: "live" | "cached_official_fixture";
  recordsRead: number;
  matchesCreated: number;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DashboardSnapshot {
  inventory: InventoryItem[];
  recalls: RecallRecord[];
  matches: PossibleMatch[];
  audit: AuditEntry[];
  latestSync: SyncRun | null;
  disclaimer: string;
}
