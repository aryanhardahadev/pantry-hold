import { resolve } from "node:path";
import {
  createStructuredLogger,
  loadDemoInventory,
} from "../../../packages/core/src/backend.js";
import {
  createDatabaseFromEnv,
  migrate,
  PantryRepository,
} from "../../../packages/db/src/index.js";
import { startWorkerHealthServer } from "./health.js";
import { PollingWorker } from "./worker.js";

const logger = createStructuredLogger("pantry-hold-worker");
const database = createDatabaseFromEnv();
const repository = new PantryRepository(database);
const abortController = new AbortController();

async function main(): Promise<void> {
  await migrate(database);
  const inventory = await loadDemoInventory(
    resolve(process.env.DEMO_INVENTORY_PATH ?? "fixtures/demo-inventory.json"),
  );
  const seeded = await repository.seedDemoIfEmpty(inventory);
  if (seeded) {
    logger.info("fictional_demo_inventory_seeded", {
      itemCount: inventory.length,
    });
  }

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
  const healthServer = await startWorkerHealthServer({
    port: numberFromEnv("WORKER_HEALTH_PORT", 3_001),
    host: process.env.HOST ?? "0.0.0.0",
    worker,
    repository,
    logger,
  });

  const shutdown = () => abortController.abort();
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  await worker.start(abortController.signal);
  await new Promise<void>((resolveClose, rejectClose) =>
    healthServer.close((error) =>
      error ? rejectClose(error) : resolveClose(),
    ),
  );
  await database.close();
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive number.`);
  }
  return parsed;
}

main().catch(async (error) => {
  logger.error("worker_crashed", {
    error: error instanceof Error ? error.message : String(error),
  });
  await database.close().catch(() => undefined);
  process.exitCode = 1;
});
