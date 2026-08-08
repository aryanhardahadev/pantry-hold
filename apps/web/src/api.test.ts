import { afterEach, describe, expect, it, vi } from "vitest";

import { apiRoutes } from "../../../packages/core/src/api.ts";
import { fetchDashboard, resetDemo, startSync, updateMatch } from "./api";

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
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await startSync();
    await resetDemo();
    await updateMatch("match-1", {
      status: "on_hold",
      note: "Moved to the designated hold area.",
    });

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
});
