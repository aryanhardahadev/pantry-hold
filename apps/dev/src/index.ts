import { resolve } from "node:path";
import { loadDemoInventory } from "../../../packages/core/src/backend.js";
import {
  createDatabaseFromEnv,
  migrate,
  PantryRepository,
} from "../../../packages/db/src/index.js";
import { buildApi } from "../../api/src/app.js";
import { PollingWorker } from "../../worker/src/worker.js";
import { createStructuredLogger } from "../../../packages/core/src/logger.js";

const logger = createStructuredLogger("pantry-hold-local-services");
const database = createDatabaseFromEnv({
  ...process.env,
  PGLITE_DATA_DIR: process.env.PGLITE_DATA_DIR ?? ".data/pantry-hold",
});
const abortController = new AbortController();

async function main(): Promise<void> {
  await migrate(database);
  const inventory = await loadDemoInventory(
    resolve(process.env.DEMO_INVENTORY_PATH ?? "fixtures/demo-inventory.json"),
  );
  const repository = new PantryRepository(database);
  await repository.seedDemoIfEmpty(inventory);

  const api = buildApi({ repository, demoInventory: inventory, logger: true });
  const worker = new PollingWorker({
    repository,
    fixturePath: resolve(
      process.env.OPENFDA_FIXTURE_PATH ?? "fixtures/openfda/H-1180-2026.json",
    ),
    recallNumber: process.env.OPENFDA_RECALL_NUMBER ?? "H-1180-2026",
    logger,
    pollIntervalMs: numberFromEnv("WORKER_POLL_INTERVAL_MS", 1_000),
    syncIntervalMs: numberFromEnv("OPENFDA_SYNC_INTERVAL_MS", 15 * 60 * 1_000),
  });

  const shutdown = () => abortController.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await api.listen({
    port: numberFromEnv("PORT", 3_000),
    host: process.env.HOST ?? "127.0.0.1",
  });

  try {
    await worker.start(abortController.signal);
  } finally {
    await api.close();
    await database.close();
  }
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

main().catch(async (error) => {
  logger.error("local_services_crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  await database.close().catch(() => undefined);
  process.exitCode = 1;
});
