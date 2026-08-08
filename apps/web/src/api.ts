import { apiRoutes } from "../../../packages/core/src/api.ts";
import type {
  DashboardSnapshot,
  MatchStatus,
  PossibleMatch,
  SyncRun,
} from "../../../packages/core/src/types.ts";

export interface MatchUpdate {
  status: Exclude<MatchStatus, "needs_review">;
  note: string;
}

export interface SyncRunAccepted {
  syncRun: SyncRun;
}

export interface DemoResetAccepted extends SyncRunAccepted {
  message: string;
}

export interface MatchUpdated {
  match: PossibleMatch;
}

export interface SyncPollingOptions {
  maxAttempts?: number;
  pollIntervalMs?: number;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      detail || `The Pantry Hold API returned ${response.status}.`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function fetchDashboard(): Promise<DashboardSnapshot> {
  return requestJson<DashboardSnapshot>(apiRoutes.dashboard);
}

export function startSync(): Promise<SyncRunAccepted> {
  return requestJson<SyncRunAccepted>(apiRoutes.syncRuns, { method: "POST" });
}

export function resetDemo(): Promise<DemoResetAccepted> {
  return requestJson<DemoResetAccepted>(apiRoutes.resetDemo, {
    method: "POST",
  });
}

export function updateMatch(
  matchId: string,
  update: MatchUpdate,
): Promise<MatchUpdated> {
  return requestJson<MatchUpdated>(apiRoutes.match(matchId), {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}

export async function waitForSyncRun(
  syncRunId: string,
  options: SyncPollingOptions = {},
): Promise<DashboardSnapshot> {
  const maxAttempts = options.maxAttempts ?? 30;
  const pollIntervalMs = options.pollIntervalMs ?? 500;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await fetchDashboard();
    const syncRun = snapshot.latestSync;

    if (syncRun?.id === syncRunId && syncRun.status === "completed") {
      return snapshot;
    }
    if (syncRun?.id === syncRunId && syncRun.status === "failed") {
      throw new Error(syncRun.error ?? "The source sync failed.");
    }

    if (attempt < maxAttempts - 1 && pollIntervalMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error("The source sync did not finish in time. Try again.");
}

export async function waitForScheduledSync(
  options: SyncPollingOptions = {},
): Promise<DashboardSnapshot> {
  const maxAttempts = options.maxAttempts ?? 30;
  const pollIntervalMs = options.pollIntervalMs ?? 500;
  let scheduledSyncId: string | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const snapshot = await fetchDashboard();
    const syncRun = snapshot.latestSync;
    scheduledSyncId ??= syncRun?.id ?? null;

    if (syncRun?.id === scheduledSyncId && syncRun.status === "completed") {
      return snapshot;
    }
    if (syncRun?.id === scheduledSyncId && syncRun.status === "failed") {
      throw new Error(syncRun.error ?? "The initial source sync failed.");
    }

    if (attempt < maxAttempts - 1 && pollIntervalMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  throw new Error("The initial source sync did not finish in time.");
}
