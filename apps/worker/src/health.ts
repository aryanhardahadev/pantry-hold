import { createServer, type Server } from "node:http";
import type { StructuredLogger } from "../../../packages/core/src/backend.js";
import type { PantryRepository } from "../../../packages/db/src/index.js";
import type { PollingWorker } from "./worker.js";

export async function startWorkerHealthServer(options: {
  port: number;
  host: string;
  worker: PollingWorker;
  repository: PantryRepository;
  logger: StructuredLogger;
}): Promise<Server> {
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");

    if (request.url === "/healthz") {
      response.statusCode = 200;
      response.end(
        JSON.stringify({
          status: "ok",
          service: "worker",
          ...options.worker.health(),
        }),
      );
      return;
    }

    if (request.url === "/readyz") {
      try {
        if (!options.worker.health().started) {
          throw new Error("worker polling loop has not started");
        }
        await options.repository.checkReady();
        response.statusCode = 200;
        response.end(JSON.stringify({ status: "ready", service: "worker" }));
      } catch (error) {
        response.statusCode = 503;
        response.end(
          JSON.stringify({
            status: "not_ready",
            service: "worker",
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ error: "not_found" }));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, () => {
      server.off("error", reject);
      resolve();
    });
  });
  options.logger.info("worker_health_listening", {
    host: options.host,
    port: options.port,
  });
  return server;
}
