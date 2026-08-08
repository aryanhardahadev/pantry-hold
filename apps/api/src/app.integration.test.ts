import { resolve } from "node:path";
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

  beforeEach(async () => {
    database = new PGliteDatabase();
    await migrate(database);
    repository = new PantryRepository(database);
    const inventory = await loadDemoInventory(
      resolve("fixtures/demo-inventory.json"),
    );
    await repository.resetDemo(inventory);
    await repository.enqueueSyncRun();

    const logger: StructuredLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const worker = new PollingWorker({
      repository,
      fixturePath: resolve("fixtures/openfda/H-1180-2026.json"),
      logger,
      fetchImpl: async () => {
        throw new Error("offline for deterministic API test");
      },
    });
    await worker.pollOnce(false);
    app = buildApi({ repository, demoInventory: inventory });
  });

  afterEach(async () => {
    await app.close();
    await database.close();
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
});
