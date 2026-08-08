import Fastify, { type FastifyInstance } from "fastify";
import { updateMatchSchema } from "../../../packages/core/src/index.js";
import type { InventoryItem } from "../../../packages/core/src/index.js";
import { PantryRepository } from "../../../packages/db/src/index.js";

export interface BuildApiOptions {
  repository: PantryRepository;
  demoInventory: InventoryItem[];
  logger?: boolean;
}

export function buildApi(options: BuildApiOptions): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.get("/healthz", async () => ({ status: "ok", service: "api" }));

  app.get("/readyz", async (_request, reply) => {
    try {
      await options.repository.checkReady();
      return { status: "ready", service: "api" };
    } catch (error) {
      reply.code(503);
      return {
        status: "not_ready",
        service: "api",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  app.get("/api/dashboard", async () => options.repository.getDashboard());

  app.post("/api/demo/reset", async (_request, reply) => {
    await options.repository.resetDemo(options.demoInventory);
    const syncRun = await options.repository.enqueueSyncRun();
    reply.code(202);
    return {
      message: "Fictional demo pantry reset; official-source sync queued.",
      syncRun,
    };
  });

  app.post("/api/sync-runs", async (_request, reply) => {
    const syncRun = await options.repository.enqueueSyncRun();
    reply.code(202);
    return { syncRun };
  });

  app.patch<{ Params: { id: string }; Body: unknown }>(
    "/api/matches/:id",
    async (request, reply) => {
      const parsed = updateMatchSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.code(400);
        return {
          error: "invalid_match_update",
          details: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        };
      }

      const match = await options.repository.updateMatchStatus(
        request.params.id,
        parsed.data.status,
        parsed.data.note,
      );
      if (!match) {
        reply.code(404);
        return { error: "possible_match_not_found" };
      }

      return { match };
    },
  );

  return app;
}
