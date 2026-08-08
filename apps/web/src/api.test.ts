import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRoutes } from "../../../packages/core/src/api.ts";
import {
  fetchDashboard,
  resetDemo,
  startSync,
  updateMatch,
  waitForScheduledSync,
  waitForSyncRun,
} from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Pantry Hold API client", () => {
  it("loads the shared dashboard route", async () => {
    const snapshot = { inventory: [], matches: [] };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(snapshot), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchDashboard()).resolves.toEqual(snapshot);
    expect(fetchMock).toHaveBeenCalledWith(
      apiRoutes.dashboard,
      expect.objectContaining({
        headers: expect.objectContaining({ Accept: "application/json" }),
      }),
    );
  });

  it("uses the shared action routes and exact update payload", async () => {
    const syncRun = {
      id: "sync-1",
      status: "queued",
      sourceMode: "live",
      recordsRead: 0,
      matchesCreated: 0,
      error: null,
      createdAt: "2026-08-09T00:00:00.000Z",
      completedAt: null,
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ syncRun }, { status: 202 }))
      .mockResolvedValueOnce(
        Response.json(
          { message: "Fictional demo pantry reset", syncRun },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(Response.json({ match: { id: "match-1" } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(startSync()).resolves.toEqual({ syncRun });
    await expect(resetDemo()).resolves.toMatchObject({ syncRun });
    await expect(
      updateMatch("match-1", {
        status: "on_hold",
        note: "Moved to the designated hold area.",
      }),
    ).resolves.toMatchObject({ match: { id: "match-1" } });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      apiRoutes.syncRuns,
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      apiRoutes.resetDemo,
      expect.objectContaining({ method: "POST" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      apiRoutes.match("match-1"),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          status: "on_hold",
          note: "Moved to the designated hold area.",
        }),
      }),
    );
  });

  it("surfaces API error text", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Worker is unavailable", { status: 503 }),
        ),
    );

    await expect(startSync()).rejects.toThrow("Worker is unavailable");
  });

  it("polls the persisted dashboard until the requested worker sync completes", async () => {
    const queued = dashboardWithSync("queued", []);
    const running = dashboardWithSync("running", []);
    const completed = dashboardWithSync("completed", [{ id: "match-1" }]);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json(queued))
        .mockResolvedValueOnce(Response.json(running))
        .mockResolvedValueOnce(Response.json(completed)),
    );

    await expect(
      waitForSyncRun("sync-1", { maxAttempts: 3, pollIntervalMs: 0 }),
    ).resolves.toEqual(completed);
  });

  it("stops polling on a worker failure or the bounded attempt limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json(dashboardWithSync("failed", [])),
        ),
    );
    await expect(
      waitForSyncRun("sync-1", { maxAttempts: 2, pollIntervalMs: 0 }),
    ).rejects.toThrow("official source unavailable");

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () =>
          Response.json(dashboardWithSync("queued", [])),
        ),
    );
    await expect(
      waitForSyncRun("sync-1", { maxAttempts: 2, pollIntervalMs: 0 }),
    ).rejects.toThrow("did not finish in time");
  });

  it("waits for the worker's scheduled initial sync from an empty dashboard", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          Response.json({
            ...dashboardWithSync("queued", []),
            latestSync: null,
          }),
        )
        .mockResolvedValueOnce(Response.json(dashboardWithSync("running", [])))
        .mockResolvedValueOnce(
          Response.json(dashboardWithSync("completed", [{ id: "match-1" }])),
        ),
    );

    await expect(
      waitForScheduledSync({ maxAttempts: 3, pollIntervalMs: 0 }),
    ).resolves.toMatchObject({
      matches: [{ id: "match-1" }],
      latestSync: { status: "completed" },
    });
  });
});

function dashboardWithSync(status: string, matches: unknown[]) {
  return {
    inventory: [],
    recalls: [],
    matches,
    audit: [],
    disclaimer: "Fictional demo pantry",
    latestSync: {
      id: "sync-1",
      status,
      sourceMode: "cached_official_fixture",
      recordsRead: status === "completed" ? 1 : 0,
      matchesCreated: status === "completed" ? 1 : 0,
      error: status === "failed" ? "official source unavailable" : null,
      createdAt: "2026-08-09T00:00:00.000Z",
      completedAt:
        status === "completed" || status === "failed"
          ? "2026-08-09T00:00:01.000Z"
          : null,
    },
  };
}
