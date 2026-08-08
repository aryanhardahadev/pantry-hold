import { resolve } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDemoInventory,
  normalizeOpenFdaRecord,
  type StructuredLogger,
} from "../../../packages/core/src/backend.js";
import {
  migrate,
  PantryRepository,
  PGliteDatabase,
} from "../../../packages/db/src/index.js";
import { startWorkerHealthServer } from "./health.js";
import { PollingWorker } from "./worker.js";

const fixturePath = resolve("fixtures/openfda/H-1180-2026.json");
const inventoryPath = resolve("fixtures/demo-inventory.json");

describe("polling worker integration", () => {
  let database: PGliteDatabase;
  let repository: PantryRepository;
  let logger: StructuredLogger;

  beforeEach(async () => {
    database = new PGliteDatabase();
    await migrate(database);
    repository = new PantryRepository(database);
    await repository.resetDemo(await loadDemoInventory(inventoryPath));
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(async () => {
    await database.close();
  });

  it("uses the real queue/worker path and remains idempotent across duplicate syncs", async () => {
    const worker = new PollingWorker({
      repository,
      fixturePath,
      logger,
      fetchImpl: async () => {
        throw new Error("simulated openFDA outage");
      },
    });

    await repository.enqueueSyncRun(new Date("2026-08-09T00:00:00.000Z"));
    const first = await worker.pollOnce(false);
    expect(first.succeeded).toBe(true);

    let dashboard = await repository.getDashboard();
    expect(dashboard.recalls).toHaveLength(1);
    expect(dashboard.recalls[0]).toMatchObject({
      id: "H-1180-2026",
      source: "openfda",
      sourceUrl:
        "https://api.fda.gov/food/enforcement.json?search=recall_number:%22H-1180-2026%22&limit=1",
      fetchedAt: "2026-08-08T19:22:00.000Z",
    });
    expect(dashboard.recalls[0]?.rawSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(dashboard.matches).toHaveLength(1);
    expect(dashboard.matches[0]).toMatchObject({
      inventoryItemId: "inventory-moringa-match",
      recallId: "H-1180-2026",
      status: "needs_review",
    });
    expect(dashboard.matches[0]?.evidence).toEqual([
      expect.objectContaining({
        type: "product_code",
        inventoryValue: "GJ96",
        recallValue: "GJ96",
        sourceEvidence: "Product code: GJ96",
      }),
      expect.objectContaining({
        type: "lot",
        inventoryValue: "25/08001",
        recallValue: "25/08001",
        sourceEvidence: "lot: 25/08001",
      }),
    ]);
    expect(
      dashboard.matches.some(
        (match) => match.inventoryItemId === "inventory-moringa-similar-name",
      ),
    ).toBe(false);
    expect(dashboard.audit).toHaveLength(1);
    expect(dashboard.latestSync).toMatchObject({
      status: "completed",
      sourceMode: "cached_official_fixture",
      recordsRead: 1,
      matchesCreated: 1,
    });

    await repository.enqueueSyncRun(new Date("2026-08-09T00:01:00.000Z"));
    const second = await worker.pollOnce(false);
    expect(second.succeeded).toBe(true);

    dashboard = await repository.getDashboard();
    expect(dashboard.recalls).toHaveLength(1);
    expect(dashboard.matches).toHaveLength(1);
    expect(dashboard.audit).toHaveLength(1);
    expect(dashboard.latestSync).toMatchObject({
      status: "completed",
      sourceMode: "cached_official_fixture",
      recordsRead: 1,
      matchesCreated: 0,
    });
    expect(logger.warn).toHaveBeenCalledWith(
      "openfda_cached_fixture_fallback",
      expect.objectContaining({ reason: "simulated openFDA outage" }),
    );
  });

  it("persists a recall with insufficient typed identifiers without matching", async () => {
    const recall = normalizeOpenFdaRecord(
      {
        recall_number: "TEST-LOT-ONLY",
        report_date: "20260809",
        classification: "Class II",
        status: "Ongoing",
        product_description: "Organic Moringa Powder",
        code_info: "lot: 25/08001",
        reason_for_recall: "Test official record reason",
        distribution_pattern: "Test official record distribution",
      },
      "https://api.fda.gov/food/enforcement.json?search=recall_number%3A%22TEST-LOT-ONLY%22",
      "2026-08-09T00:00:00.000Z",
    );

    await repository.upsertRecall(recall);
    expect(await repository.createPossibleMatches(recall)).toBe(0);

    const dashboard = await repository.getDashboard();
    expect(dashboard.recalls).toHaveLength(1);
    expect(dashboard.matches).toHaveLength(0);
  });

  it("reports worker liveness and database readiness over the internal HTTP port", async () => {
    const worker = new PollingWorker({
      repository,
      fixturePath,
      logger,
      fetchImpl: async () => {
        throw new Error("offline for deterministic health test");
      },
    });
    const abortController = new AbortController();
    const workerCompletion = worker.start(abortController.signal);
    const server = await startWorkerHealthServer({
      port: 0,
      host: "127.0.0.1",
      worker,
      repository,
      logger,
    });

    try {
      const { port } = server.address() as AddressInfo;
      const health = await fetch(`http://127.0.0.1:${port}/healthz`);
      expect(health.status).toBe(200);
      await expect(health.json()).resolves.toMatchObject({
        status: "ok",
        service: "worker",
        started: true,
      });

      const ready = await fetch(`http://127.0.0.1:${port}/readyz`);
      expect(ready.status).toBe(200);
      await expect(ready.json()).resolves.toEqual({
        status: "ready",
        service: "worker",
      });
    } finally {
      abortController.abort();
      await workerCompletion;
      await new Promise<void>((resolveClose, rejectClose) =>
        server.close((error) => (error ? rejectClose(error) : resolveClose())),
      );
    }
  });
});
