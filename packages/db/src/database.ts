import { PGlite } from "@electric-sql/pglite";
import { mkdirSync } from "node:fs";
import { Pool, type QueryResultRow } from "pg";

export type SqlRow = Record<string, unknown>;

export interface SqlResult<T extends SqlRow = SqlRow> {
  rows: T[];
  rowCount: number;
}

export interface SqlClient {
  query<T extends SqlRow = SqlRow>(
    sql: string,
    params?: unknown[],
  ): Promise<SqlResult<T>>;
}

export interface Database extends SqlClient {
  transaction<T>(callback: (client: SqlClient) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export class PGliteDatabase implements Database {
  private readonly client: PGlite;

  constructor(dataDir?: string) {
    this.client = dataDir ? new PGlite(dataDir) : new PGlite();
  }

  async query<T extends SqlRow = SqlRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<SqlResult<T>> {
    const result = await this.client.query<T>(sql, params);
    return {
      rows: result.rows,
      rowCount: result.affectedRows ?? result.rows.length,
    };
  }

  async transaction<T>(
    callback: (client: SqlClient) => Promise<T>,
  ): Promise<T> {
    return this.client.transaction(async (transaction) =>
      callback({
        query: async <TRow extends SqlRow = SqlRow>(
          sql: string,
          params: unknown[] = [],
        ) => {
          const result = await transaction.query<TRow>(sql, params);
          return {
            rows: result.rows,
            rowCount: result.affectedRows ?? result.rows.length,
          };
        },
      }),
    );
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

export class PgDatabase implements Database {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  async query<T extends SqlRow = SqlRow>(
    sql: string,
    params: unknown[] = [],
  ): Promise<SqlResult<T>> {
    const result = await this.pool.query<T & QueryResultRow>(sql, params);
    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
    };
  }

  async transaction<T>(
    callback: (client: SqlClient) => Promise<T>,
  ): Promise<T> {
    const connection = await this.pool.connect();
    try {
      await connection.query("BEGIN");
      const result = await callback({
        query: async <TRow extends SqlRow = SqlRow>(
          sql: string,
          params: unknown[] = [],
        ) => {
          const queryResult = await connection.query<TRow & QueryResultRow>(
            sql,
            params,
          );
          return {
            rows: queryResult.rows,
            rowCount: queryResult.rowCount ?? queryResult.rows.length,
          };
        },
      });
      await connection.query("COMMIT");
      return result;
    } catch (error) {
      await connection.query("ROLLBACK");
      throw error;
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export function createDatabaseFromEnv(
  environment: NodeJS.ProcessEnv = process.env,
): Database {
  const connectionString = environment.DATABASE_URL;
  if (connectionString) {
    return new PgDatabase(connectionString);
  }

  const dataDir = environment.PGLITE_DATA_DIR;
  if (dataDir) {
    mkdirSync(dataDir, { recursive: true });
  }
  return new PGliteDatabase(dataDir);
}
