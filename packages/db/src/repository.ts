import { randomUUID } from "node:crypto";
import {
  findExactIdentifierMatches,
  type AuditEntry,
  type DashboardSnapshot,
  type InventoryItem,
  type MatchStatus,
  type PossibleMatch,
  type RecallRecord,
  type SyncRun,
  type TypedIdentifier,
} from "../../core/src/index.js";
import type { Database, SqlClient, SqlRow } from "./database.js";

const disclaimer =
  "Fictional demo pantry. Possible matches require an exact lot and an exact product code or UPC; they are not safety or compliance determinations.";

interface InventoryRow extends SqlRow {
  id: string;
  name: string;
  shelf: string;
  quantity: number;
  unit: string;
  estimated_meal_portions: number;
  identifiers: unknown;
  demo_data: boolean;
}

interface RecallRow extends SqlRow {
  id: string;
  source: "openfda";
  source_url: string;
  fetched_at: string | Date;
  report_date: string;
  classification: string;
  status: string;
  product_description: string;
  code_info: string;
  reason_for_recall: string;
  distribution_pattern: string;
  identifiers: unknown;
  raw_sha256: string;
}

interface MatchRow extends SqlRow {
  id: string;
  inventory_item_id: string;
  recall_id: string;
  status: MatchStatus;
  evidence: unknown;
  created_at: string | Date;
  updated_at: string | Date;
}

interface AuditRow extends SqlRow {
  id: string;
  match_id: string;
  action: AuditEntry["action"];
  note: string;
  created_at: string | Date;
}

interface SyncRunRow extends SqlRow {
  id: string;
  status: SyncRun["status"];
  source_mode: SyncRun["sourceMode"];
  records_read: number;
  matches_created: number;
  error: string | null;
  created_at: string | Date;
  completed_at: string | Date | null;
}

export class PantryRepository {
  constructor(private readonly database: Database) {}

  async resetDemo(inventory: InventoryItem[]): Promise<void> {
    await this.database.transaction(async (client) => {
      await client.query("DELETE FROM audit_entries");
      await client.query("DELETE FROM possible_matches");
      await client.query("DELETE FROM recalls");
      await client.query("DELETE FROM sync_runs");
      await client.query("DELETE FROM inventory_items");

      await insertInventory(client, inventory);
    });
  }

  async seedDemoIfEmpty(inventory: InventoryItem[]): Promise<boolean> {
    return this.database.transaction(async (client) => {
      // API and worker may both initialize a fresh production database. This
      // lock prevents competing seed transactions from deleting or duplicating
      // the fictional inventory.
      await client.query("SELECT pg_advisory_xact_lock(358572027)");
      const result = await client.query<{ count: string | number }>(
        "SELECT COUNT(*) AS count FROM inventory_items",
      );
      if (Number(result.rows[0]?.count ?? 0) > 0) {
        return false;
      }

      await insertInventory(client, inventory);
      return true;
    });
  }

  async enqueueSyncRun(now = new Date()): Promise<SyncRun> {
    const id = randomUUID();
    const createdAt = now.toISOString();
    const result = await this.database.query<SyncRunRow>(
      `INSERT INTO sync_runs (
        id, status, source_mode, records_read, matches_created, error,
        created_at, completed_at
      ) VALUES ($1, 'queued', 'live', 0, 0, NULL, $2, NULL)
      RETURNING *`,
      [id, createdAt],
    );
    return mapSyncRun(requireRow(result.rows[0], "queued sync run"));
  }

  async claimNextSyncRun(): Promise<SyncRun | null> {
    const result = await this.database.query<SyncRunRow>(
      `WITH next_sync AS (
        SELECT id
        FROM sync_runs
        WHERE status = 'queued'
        ORDER BY created_at ASC
        LIMIT 1
      )
      UPDATE sync_runs
      SET status = 'running'
      FROM next_sync
      WHERE sync_runs.id = next_sync.id
        AND sync_runs.status = 'queued'
      RETURNING sync_runs.*`,
    );
    return result.rows[0] ? mapSyncRun(result.rows[0]) : null;
  }

  async completeSyncRun(
    id: string,
    result: {
      sourceMode: SyncRun["sourceMode"];
      recordsRead: number;
      matchesCreated: number;
    },
    now = new Date(),
  ): Promise<void> {
    await this.database.query(
      `UPDATE sync_runs
       SET status = 'completed', source_mode = $2, records_read = $3,
           matches_created = $4, error = NULL, completed_at = $5
       WHERE id = $1`,
      [
        id,
        result.sourceMode,
        result.recordsRead,
        result.matchesCreated,
        now.toISOString(),
      ],
    );
  }

  async failSyncRun(
    id: string,
    error: string,
    now = new Date(),
  ): Promise<void> {
    await this.database.query(
      `UPDATE sync_runs
       SET status = 'failed', error = $2, completed_at = $3
       WHERE id = $1`,
      [id, error, now.toISOString()],
    );
  }

  async hasActiveSyncRun(): Promise<boolean> {
    const result = await this.database.query<{ count: string | number }>(
      `SELECT COUNT(*) AS count FROM sync_runs
       WHERE status IN ('queued', 'running')`,
    );
    return Number(result.rows[0]?.count ?? 0) > 0;
  }

  async getLatestSyncRun(): Promise<SyncRun | null> {
    const result = await this.database.query<SyncRunRow>(
      "SELECT * FROM sync_runs ORDER BY created_at DESC LIMIT 1",
    );
    return result.rows[0] ? mapSyncRun(result.rows[0]) : null;
  }

  async upsertRecall(recall: RecallRecord): Promise<void> {
    await this.database.query(
      `INSERT INTO recalls (
        id, source, source_url, fetched_at, report_date, classification,
        status, product_description, code_info, reason_for_recall,
        distribution_pattern, identifiers, raw_sha256
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13
      )
      ON CONFLICT (id) DO UPDATE SET
        source = EXCLUDED.source,
        source_url = EXCLUDED.source_url,
        fetched_at = EXCLUDED.fetched_at,
        report_date = EXCLUDED.report_date,
        classification = EXCLUDED.classification,
        status = EXCLUDED.status,
        product_description = EXCLUDED.product_description,
        code_info = EXCLUDED.code_info,
        reason_for_recall = EXCLUDED.reason_for_recall,
        distribution_pattern = EXCLUDED.distribution_pattern,
        identifiers = EXCLUDED.identifiers,
        raw_sha256 = EXCLUDED.raw_sha256`,
      [
        recall.id,
        recall.source,
        recall.sourceUrl,
        recall.fetchedAt,
        recall.reportDate,
        recall.classification,
        recall.status,
        recall.productDescription,
        recall.codeInfo,
        recall.reasonForRecall,
        recall.distributionPattern,
        JSON.stringify(recall.identifiers),
        recall.rawSha256,
      ],
    );
  }

  async createPossibleMatches(recall: RecallRecord): Promise<number> {
    const inventory = await this.listInventory();
    let created = 0;

    for (const item of inventory) {
      const evidence = findExactIdentifierMatches(item, recall);
      if (evidence.length === 0) {
        continue;
      }

      const matchId = `possible-match:${item.id}:${recall.id}`;
      const now = new Date().toISOString();
      const inserted = await this.database.transaction(async (client) => {
        const result = await client.query<{ id: string }>(
          `INSERT INTO possible_matches (
            id, inventory_item_id, recall_id, status, evidence,
            created_at, updated_at
          ) VALUES ($1, $2, $3, 'needs_review', $4::jsonb, $5, $5)
          ON CONFLICT (inventory_item_id, recall_id) DO NOTHING
          RETURNING id`,
          [matchId, item.id, recall.id, JSON.stringify(evidence), now],
        );
        if (!result.rows[0]) {
          return false;
        }

        await client.query(
          `INSERT INTO audit_entries (id, match_id, action, note, created_at)
           VALUES ($1, $2, 'match_created', $3, $4)`,
          [
            `audit:${matchId}:created`,
            matchId,
            "Possible match created from an exact lot and exact product-level identifier.",
            now,
          ],
        );
        return true;
      });

      if (inserted) {
        created += 1;
      }
    }

    return created;
  }

  async updateMatchStatus(
    id: string,
    status: Exclude<MatchStatus, "needs_review">,
    note: string,
  ): Promise<PossibleMatch | null> {
    return this.database.transaction(async (client) => {
      const existing = await client.query<MatchRow>(
        "SELECT * FROM possible_matches WHERE id = $1",
        [id],
      );
      if (!existing.rows[0]) {
        return null;
      }

      const now = new Date().toISOString();
      const updated = await client.query<MatchRow>(
        `UPDATE possible_matches
         SET status = $2, updated_at = $3
         WHERE id = $1
         RETURNING *`,
        [id, status, now],
      );
      await client.query(
        `INSERT INTO audit_entries (id, match_id, action, note, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          id,
          status === "on_hold" ? "placed_on_hold" : "resolved",
          note,
          now,
        ],
      );

      return mapMatch(requireRow(updated.rows[0], "updated possible match"));
    });
  }

  async getDashboard(): Promise<DashboardSnapshot> {
    const [inventory, recalls, matches, audit, latestSync] = await Promise.all([
      this.listInventory(),
      this.listRecalls(),
      this.listMatches(),
      this.listAudit(),
      this.getLatestSyncRun(),
    ]);

    return {
      inventory,
      recalls,
      matches,
      audit,
      latestSync,
      disclaimer,
    };
  }

  async checkReady(): Promise<void> {
    await this.database.query("SELECT 1 AS ready");
  }

  private async listInventory(): Promise<InventoryItem[]> {
    const result = await this.database.query<InventoryRow>(
      "SELECT * FROM inventory_items ORDER BY id",
    );
    return result.rows.map(mapInventoryItem);
  }

  private async listRecalls(): Promise<RecallRecord[]> {
    const result = await this.database.query<RecallRow>(
      "SELECT * FROM recalls ORDER BY report_date DESC, id",
    );
    return result.rows.map(mapRecall);
  }

  private async listMatches(): Promise<PossibleMatch[]> {
    const result = await this.database.query<MatchRow>(
      "SELECT * FROM possible_matches ORDER BY created_at, id",
    );
    return result.rows.map(mapMatch);
  }

  private async listAudit(): Promise<AuditEntry[]> {
    const result = await this.database.query<AuditRow>(
      "SELECT * FROM audit_entries ORDER BY created_at, id",
    );
    return result.rows.map(mapAudit);
  }
}

function mapInventoryItem(row: InventoryRow): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    shelf: row.shelf,
    quantity: Number(row.quantity),
    unit: row.unit,
    estimatedMealPortions: Number(row.estimated_meal_portions),
    identifiers: parseJson<TypedIdentifier[]>(row.identifiers),
    demoData: true,
  };
}

function mapRecall(row: RecallRow): RecallRecord {
  return {
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    fetchedAt: toIsoString(row.fetched_at),
    reportDate: row.report_date,
    classification: row.classification,
    status: row.status,
    productDescription: row.product_description,
    codeInfo: row.code_info,
    reasonForRecall: row.reason_for_recall,
    distributionPattern: row.distribution_pattern,
    identifiers: parseJson<TypedIdentifier[]>(row.identifiers),
    rawSha256: row.raw_sha256,
  };
}

function mapMatch(row: MatchRow): PossibleMatch {
  return {
    id: row.id,
    inventoryItemId: row.inventory_item_id,
    recallId: row.recall_id,
    status: row.status,
    evidence: parseJson<PossibleMatch["evidence"]>(row.evidence),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function mapAudit(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    matchId: row.match_id,
    action: row.action,
    note: row.note,
    createdAt: toIsoString(row.created_at),
  };
}

function mapSyncRun(row: SyncRunRow): SyncRun {
  return {
    id: row.id,
    status: row.status,
    sourceMode: row.source_mode,
    recordsRead: Number(row.records_read),
    matchesCreated: Number(row.matches_created),
    error: row.error,
    createdAt: toIsoString(row.created_at),
    completedAt: row.completed_at ? toIsoString(row.completed_at) : null,
  };
}

function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}

function toIsoString(value: string | Date): string {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString();
}

function requireRow<T>(row: T | undefined, description: string): T {
  if (!row) {
    throw new Error(`Database did not return the ${description}.`);
  }
  return row;
}

async function insertInventory(
  client: SqlClient,
  inventory: InventoryItem[],
): Promise<void> {
  for (const item of inventory) {
    await client.query(
      `INSERT INTO inventory_items (
        id, name, shelf, quantity, unit, estimated_meal_portions,
        identifiers, demo_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, TRUE)`,
      [
        item.id,
        item.name,
        item.shelf,
        item.quantity,
        item.unit,
        item.estimatedMealPortions,
        JSON.stringify(item.identifiers),
      ],
    );
  }
}
