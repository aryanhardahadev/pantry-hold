import { apiRoutes } from "../../../packages/core/src/api.ts";
import type {
  DashboardSnapshot,
  MatchStatus,
} from "../../../packages/core/src/types.ts";

export interface MatchUpdate {
  status: Exclude<MatchStatus, "needs_review">;
  note: string;
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

export function startSync(): Promise<unknown> {
  return requestJson(apiRoutes.syncRuns, { method: "POST" });
}

export function resetDemo(): Promise<unknown> {
  return requestJson(apiRoutes.resetDemo, { method: "POST" });
}

export function updateMatch(
  matchId: string,
  update: MatchUpdate,
): Promise<unknown> {
  return requestJson(apiRoutes.match(matchId), {
    method: "PATCH",
    body: JSON.stringify(update),
  });
}
