import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadDemoInventory,
  type StructuredLogger,
} from "../../../packages/core/src/backend.js";
import {
  migrate,
  PantryRepository,
  PGliteDatabase,
} from "../../../packages/db/src/index.js";
import { PollingWorker } from "../../worker/src/worker.js";
import { buildApi } from "./app.js";

describe("Fastify API integration", () => {
  let database: PGliteDatabase;
  let repository: PantryRepository;
  let app: ReturnType<typeof buildApi>;
  let webRoot: string;
  let worker: PollingWorker;

  beforeEach(async () => {
    database = new PGliteDatabase();
    await migrate(database);
    repository = new PantryRepository(database);
    const inventory = await loadDemoInventory(
      resolve("fixtures/demo-inventory.json"),
    );
    webRoot = await mkdtemp(join(tmpdir(), "pantry-hold-web-"));
    await writeFile(
      join(webRoot, "index.html"),
      '<!doctype html><title>Pantry Hold integration</title><div id="root"></div>',
      "utf8",
    );
    await repository.resetDemo(inventory);
    await repository.enqueueSyncRun();

    const logger: StructuredLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    worker = new PollingWorker({
      repository,
      fixturePath: resolve("fixtures/openfda/H-1180-2026.json"),
      logger,
      fetchImpl: async () => {
        throw new Error("offline for deterministic API test");
      },
    });
    await worker.pollOnce(false);
    app = buildApi({ repository, demoInventory: inventory, webRoot });
  });

  afterEach(async () => {
    await app.close();
    await database.close();
    await rm(webRoot, { recursive: true, force: true });
  });

  it("exposes health, dashboard, and persisted review actions", async () => {
    const health = await app.inject({ method: "GET", url: "/healthz" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok", service: "api" });

    const ready = await app.inject({ method: "GET", url: "/readyz" });
    expect(ready.statusCode).toBe(200);

    const dashboardResponse = await app.inject({
      method: "GET",
      url: "/api/dashboard",
    });
    const dashboard = dashboardResponse.json();
    expect(dashboard.matches).toHaveLength(1);
    expect(dashboard.disclaimer).toContain("Possible matches require");

    const matchId = dashboard.matches[0].id as string;
    const hold = await app.inject({
      method: "PATCH",
      url: `/api/matches/${encodeURIComponent(matchId)}`,
      payload: { status: "on_hold", note: "Moved to the review shelf." },
    });
    expect(hold.statusCode).toBe(200);
    expect(hold.json().match.status).toBe("on_hold");

    const resolved = await app.inject({
      method: "PATCH",
      url: `/api/matches/${encodeURIComponent(matchId)}`,
      payload: {
        status: "resolved",
        note: "Identifier evidence reviewed; workflow closed.",
      },
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json().match.status).toBe("resolved");

    const updatedDashboard = (
      await app.inject({ method: "GET", url: "/api/dashboard" })
    ).json();
    expect(updatedDashboard.audit).toHaveLength(3);
    expect(updatedDashboard.audit[1]).toMatchObject({
      action: "placed_on_hold",
      note: "Moved to the review shelf.",
    });
    expect(updatedDashboard.audit[2]).toMatchObject({
      action: "resolved",
      note: "Identifier evidence reviewed; workflow closed.",
    });
  });

  it("rejects safety-like freeform status values and unknown matches", async () => {
    const invalid = await app.inject({
      method: "PATCH",
      url: "/api/matches/anything",
      payload: { status: "unsafe", note: "Unsupported claim" },
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({
      method: "PATCH",
      url: "/api/matches/missing",
      payload: { status: "resolved", note: "No pantry item found." },
    });
    expect(missing.statusCode).toBe(404);
  });

  it("serves the built web entry and an SPA fallback without masking API 404s", async () => {
    const root = await app.inject({ method: "GET", url: "/" });
    expect(root.statusCode).toBe(200);
    expect(root.headers["content-type"]).toContain("text/html");
    expect(root.body).toContain("Pantry Hold integration");

    const spa = await app.inject({ method: "GET", url: "/review/match-1" });
    expect(spa.statusCode).toBe(200);
    expect(spa.body).toContain("Pantry Hold integration");

    const missingApi = await app.inject({
      method: "GET",
      url: "/api/unknown",
    });
    expect(missingApi.statusCode).toBe(404);
    expect(missingApi.json()).toEqual({ error: "not_found" });
  });

  it("completes reset through the queued worker and persisted API path", async () => {
    const reset = await app.inject({ method: "POST", url: "/api/demo/reset" });
    expect(reset.statusCode).toBe(202);
    const syncRunId = reset.json().syncRun.id as string;

    const queued = (
      await app.inject({ method: "GET", url: "/api/dashboard" })
    ).json();
    expect(queued.matches).toHaveLength(0);
    expect(queued.latestSync).toMatchObject({
      id: syncRunId,
      status: "queued",
    });

    await expect(worker.pollOnce(false)).resolves.toMatchObject({
      succeeded: true,
    });

    const completed = (
      await app.inject({ method: "GET", url: "/api/dashboard" })
    ).json();
    expect(completed.latestSync).toMatchObject({
      id: syncRunId,
      status: "completed",
      matchesCreated: 1,
    });
    expect(completed.matches).toEqual([
      expect.objectContaining({
        inventoryItemId: "inventory-moringa-match",
        recallId: "H-1180-2026",
      }),
    ]);
  });
});
