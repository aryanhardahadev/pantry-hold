import { z } from "zod";

export const matchStatusSchema = z.enum([
  "needs_review",
  "on_hold",
  "resolved",
]);

export const updateMatchSchema = z.object({
  status: matchStatusSchema.exclude(["needs_review"]),
  note: z.string().trim().min(1).max(280),
});

export type UpdateMatchInput = z.infer<typeof updateMatchSchema>;

export const apiRoutes = {
  dashboard: "/api/dashboard",
  resetDemo: "/api/demo/reset",
  syncRuns: "/api/sync-runs",
  match: (id: string) => `/api/matches/${id}`,
} as const;
