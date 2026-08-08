import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDemoInventory } from "../../core/src/backend.js";
import { createDatabaseFromEnv, PGliteDatabase } from "./database.js";
import { migrate } from "./migrations.js";
import { PantryRepository } from "./repository.js";

describe("database initialization", () => {
  const databases: PGliteDatabase[] = [];

  afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.close()));
  });

  it("applies migrations and fictional demo seeding idempotently", async () => {
    const database = new PGliteDatabase();
    databases.push(database);

    await migrate(database);
    await migrate(database);

    const repository = new PantryRepository(database);
    const inventory = await loadDemoInventory(
      resolve("fixtures/demo-inventory.json"),
    );
    expect(await repository.seedDemoIfEmpty(inventory)).toBe(true);
    expect(await repository.seedDemoIfEmpty(inventory)).toBe(false);

    const dashboard = await repository.getDashboard();
    expect(dashboard.inventory).toHaveLength(3);
    expect(dashboard.inventory.every((item) => item.demoData)).toBe(true);
  });

  it("persists the fictional demo across a file-backed PGlite reopen", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "pantry-hold-pglite-"));
    try {
      const persistentDataDir = join(dataDir, "nested", "database");
      const firstDatabase = createDatabaseFromEnv({
        PGLITE_DATA_DIR: persistentDataDir,
      });
      await migrate(firstDatabase);
      const firstRepository = new PantryRepository(firstDatabase);
      await firstRepository.seedDemoIfEmpty(
        await loadDemoInventory(resolve("fixtures/demo-inventory.json")),
      );
      await firstDatabase.close();

      const reopenedDatabase = new PGliteDatabase(persistentDataDir);
      databases.push(reopenedDatabase);
      await migrate(reopenedDatabase);
      const dashboard = await new PantryRepository(
        reopenedDatabase,
      ).getDashboard();

      expect(dashboard.inventory).toHaveLength(3);
      expect(dashboard.inventory.every((item) => item.demoData)).toBe(true);
    } finally {
      await Promise.all(
        databases.splice(0).map((database) => database.close()),
      );
      await rm(dataDir, { recursive: true, force: true });
    }
  });
});
