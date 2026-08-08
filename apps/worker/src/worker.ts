import { setTimeout as delay } from "node:timers/promises";
import {
  loadOpenFdaRecall,
  type LoadOpenFdaOptions,
  type StructuredLogger,
} from "../../../packages/core/src/backend.js";
import type { SyncRun } from "../../../packages/core/src/index.js";
import { PantryRepository } from "../../../packages/db/src/index.js";

export interface WorkerOptions {
  repository: PantryRepository;
  fixturePath: string;
  logger: StructuredLogger;
  recallNumber?: string;
  fetchImpl?: LoadOpenFdaOptions["fetchImpl"];
  now?: () => Date;
  pollIntervalMs?: number;
  syncIntervalMs?: number;
}

export interface WorkerPollResult {
  syncRun: SyncRun | null;
  succeeded: boolean;
}

export class PollingWorker {
  private readonly now: () => Date;
  private readonly pollIntervalMs: number;
  private readonly syncIntervalMs: number;
  private lastPollAt: string | null = null;
  private started = false;

  constructor(private readonly options: WorkerOptions) {
    this.now = options.now ?? (() => new Date());
    this.pollIntervalMs = options.pollIntervalMs ?? 1_000;
    this.syncIntervalMs = options.syncIntervalMs ?? 15 * 60 * 1_000;
  }

  health(): { started: boolean; lastPollAt: string | null } {
    return { started: this.started, lastPollAt: this.lastPollAt };
  }

  async pollOnce(scheduleIfDue = true): Promise<WorkerPollResult> {
    this.lastPollAt = this.now().toISOString();
    if (scheduleIfDue) {
      await this.enqueueScheduledSyncIfDue();
    }

    const syncRun = await this.options.repository.claimNextSyncRun();
    if (!syncRun) {
      return { syncRun: null, succeeded: true };
    }

    this.options.logger.info("sync_started", { syncRunId: syncRun.id });
    try {
      const loaded = await loadOpenFdaRecall({
        recallNumber: this.options.recallNumber,
        fixturePath: this.options.fixturePath,
        fetchImpl: this.options.fetchImpl,
        now: this.now,
        onFallback: (reason) =>
          this.options.logger.warn("openfda_cached_fixture_fallback", {
            syncRunId: syncRun.id,
            reason,
          }),
      });

      let matchesCreated = 0;
      for (const recall of loaded.records) {
        await this.options.repository.upsertRecall(recall);
        matchesCreated +=
          await this.options.repository.createPossibleMatches(recall);
      }

      await this.options.repository.completeSyncRun(
        syncRun.id,
        {
          sourceMode: loaded.sourceMode,
          recordsRead: loaded.records.length,
          matchesCreated,
        },
        this.now(),
      );
      this.options.logger.info("sync_completed", {
        syncRunId: syncRun.id,
        sourceMode: loaded.sourceMode,
        recordsRead: loaded.records.length,
        matchesCreated,
      });
      return { syncRun, succeeded: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.options.repository.failSyncRun(
        syncRun.id,
        message,
        this.now(),
      );
      this.options.logger.error("sync_failed", {
        syncRunId: syncRun.id,
        error: message,
      });
      return { syncRun, succeeded: false };
    }
  }

  async start(signal: AbortSignal): Promise<void> {
    this.started = true;
    this.options.logger.info("worker_started", {
      pollIntervalMs: this.pollIntervalMs,
      syncIntervalMs: this.syncIntervalMs,
    });

    try {
      while (!signal.aborted) {
        await this.pollOnce(true);
        try {
          await delay(this.pollIntervalMs, undefined, { signal });
        } catch (error) {
          if (!signal.aborted) {
            throw error;
          }
        }
      }
    } finally {
      this.started = false;
      this.options.logger.info("worker_stopped");
    }
  }

  private async enqueueScheduledSyncIfDue(): Promise<void> {
    if (await this.options.repository.hasActiveSyncRun()) {
      return;
    }

    const latest = await this.options.repository.getLatestSyncRun();
    const due =
      !latest ||
      this.now().getTime() - new Date(latest.createdAt).getTime() >=
        this.syncIntervalMs;
    if (!due) {
      return;
    }

    const queued = await this.options.repository.enqueueSyncRun(this.now());
    this.options.logger.info("sync_scheduled", { syncRunId: queued.id });
  }
}
