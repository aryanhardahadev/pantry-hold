import type { Database } from "./database.js";

interface Migration {
  version: number;
  name: string;
  statements: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_pantry_hold_schema",
    statements: [
      `CREATE TABLE IF NOT EXISTS inventory_items (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        shelf TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity >= 0),
        unit TEXT NOT NULL,
        estimated_meal_portions INTEGER NOT NULL CHECK (estimated_meal_portions >= 0),
        identifiers JSONB NOT NULL,
        demo_data BOOLEAN NOT NULL CHECK (demo_data = TRUE)
      )`,
      `CREATE TABLE IF NOT EXISTS recalls (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL CHECK (source = 'openfda'),
        source_url TEXT NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL,
        report_date TEXT NOT NULL,
        classification TEXT NOT NULL,
        status TEXT NOT NULL,
        product_description TEXT NOT NULL,
        code_info TEXT NOT NULL,
        reason_for_recall TEXT NOT NULL,
        distribution_pattern TEXT NOT NULL,
        identifiers JSONB NOT NULL,
        raw_sha256 TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS possible_matches (
        id TEXT PRIMARY KEY,
        inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
        recall_id TEXT NOT NULL REFERENCES recalls(id) ON DELETE CASCADE,
        status TEXT NOT NULL CHECK (status IN ('needs_review', 'on_hold', 'resolved')),
        evidence JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        UNIQUE (inventory_item_id, recall_id)
      )`,
      `CREATE TABLE IF NOT EXISTS audit_entries (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL REFERENCES possible_matches(id) ON DELETE CASCADE,
        action TEXT NOT NULL CHECK (action IN ('match_created', 'placed_on_hold', 'resolved')),
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS sync_runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
        source_mode TEXT NOT NULL CHECK (source_mode IN ('live', 'cached_official_fixture')),
        records_read INTEGER NOT NULL DEFAULT 0 CHECK (records_read >= 0),
        matches_created INTEGER NOT NULL DEFAULT 0 CHECK (matches_created >= 0),
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL,
        completed_at TIMESTAMPTZ
      )`,
      `CREATE INDEX IF NOT EXISTS sync_runs_status_created_idx
        ON sync_runs (status, created_at)`,
      `CREATE INDEX IF NOT EXISTS audit_entries_match_created_idx
        ON audit_entries (match_id, created_at)`,
    ],
  },
];

export async function migrate(database: Database): Promise<void> {
  await database.transaction(async (client) => {
    // API and worker may start together against the same production database.
    // A transaction-scoped advisory lock serializes their migration runners.
    await client.query("SELECT pg_advisory_xact_lock(358572026)");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL
    )`);

    const appliedResult = await client.query<{ version: number }>(
      "SELECT version FROM schema_migrations",
    );
    const applied = new Set(
      appliedResult.rows.map((row) => Number(row.version)),
    );

    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue;
      }

      for (const statement of migration.statements) {
        await client.query(statement);
      }
      await client.query(
        `INSERT INTO schema_migrations (version, name, applied_at)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, new Date().toISOString()],
      );
    }
  });
}
