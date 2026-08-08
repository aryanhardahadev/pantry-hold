import { resolve } from "node:path";
import { loadDemoInventory } from "../../../packages/core/src/backend.js";
import {
  createDatabaseFromEnv,
  migrate,
  PantryRepository,
} from "../../../packages/db/src/index.js";
import { buildApi } from "./app.js";

const database = createDatabaseFromEnv();

async function main(): Promise<void> {
  await migrate(database);
  const inventory = await loadDemoInventory(
    resolve(process.env.DEMO_INVENTORY_PATH ?? "fixtures/demo-inventory.json"),
  );
  const repository = new PantryRepository(database);
  await repository.seedDemoIfEmpty(inventory);

  const app = buildApi({
    repository,
    demoInventory: inventory,
    logger: true,
    webRoot: resolve(process.env.WEB_ROOT ?? "dist/web"),
  });
  const close = async () => {
    await app.close();
    await database.close();
  };
  process.once("SIGINT", () => void close());
  process.once("SIGTERM", () => void close());

  await app.listen({
    port: numberFromEnv("PORT", 3_000),
    host: process.env.HOST ?? "0.0.0.0",
  });
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`${name} must be a valid TCP port.`);
  }
  return parsed;
}

main().catch(async (error) => {
  console.error(
    JSON.stringify({
      level: "error",
      time: new Date().toISOString(),
      service: "pantry-hold-api",
      event: "api_crashed",
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  await database.close().catch(() => undefined);
  process.exitCode = 1;
});
