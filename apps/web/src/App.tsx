import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  AuditEntry,
  DashboardSnapshot,
  MatchStatus,
  SyncRun,
} from "../../../packages/core/src/types.ts";

import {
  fetchDashboard,
  resetDemo,
  startSync,
  updateMatch,
  waitForScheduledSync,
  waitForSyncRun,
  type SyncRunAccepted,
} from "./api";
import {
  deriveDashboardView,
  identifierLabel,
  type MatchDetail,
} from "./dashboard";

type ActionName = "sync" | "reset" | `match:${string}`;

const defaultHoldNote = "Moved to the designated hold area for review.";
const defaultResolveNote =
  "Review completed; item released from this demo hold.";

function formatDate(value: string | null | undefined): string {
  if (!value) return "Not yet available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatReportDate(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return formatDate(
      `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}T00:00:00Z`,
    );
  }
  return formatDate(value);
}

export function plural(
  value: number,
  singular: string,
  pluralForm = `${singular}s`,
) {
  return value === 1 ? singular : pluralForm;
}

export function matchActionState(status: MatchStatus) {
  const isNeedsReview = status === "needs_review";
  return {
    targetStatus: isNeedsReview ? ("on_hold" as const) : ("resolved" as const),
    defaultNote: isNeedsReview ? defaultHoldNote : defaultResolveNote,
    noteLabel: isNeedsReview ? "Hold note" : "Resolution note",
    submitLabel: isNeedsReview ? "Hold for staff review" : "Resolve review",
  };
}

export function matchActionStateKey(
  matchId: string,
  status: MatchStatus,
): string {
  return `${matchId}:${status}`;
}

function statusLabel(status: MatchStatus): string {
  if (status === "needs_review") return "Possible identifier match";
  if (status === "on_hold") return "Held for staff review";
  return "Resolved";
}

function syncModeLabel(sync: SyncRun | null): string {
  if (!sync) return "No source sync yet";
  if (sync.status === "queued") return "Official-source sync queued";
  if (sync.status === "running") return "Official-source sync running";
  if (sync.status === "failed") return "Official-source sync failed";
  return sync.sourceMode === "live"
    ? "Live official openFDA response"
    : "Cached official openFDA response";
}

function auditLabel(entry: AuditEntry): string {
  if (entry.action === "match_created") return "Possible match created";
  if (entry.action === "placed_on_hold") return "Placed on hold";
  return "Review resolved";
}

function SourceFreshness({ sync }: { sync: SyncRun | null }) {
  return (
    <div className="source-freshness" aria-label="Recall source status">
      <span className={`source-dot ${sync?.status ?? "idle"}`} />
      <div>
        <strong>{syncModeLabel(sync)}</strong>
        <span>
          {sync
            ? `${statusLabelForSync(sync.status)} · ${formatDate(sync.completedAt ?? sync.createdAt)}`
            : "Run a sync to load the official source"}
        </span>
      </div>
    </div>
  );
}

function statusLabelForSync(status: SyncRun["status"]): string {
  if (status === "queued") return "Queued";
  if (status === "running") return "Syncing";
  if (status === "completed") return "Last synced";
  return "Sync failed";
}

function LoadingState() {
  return (
    <main className="page-shell" aria-busy="true" aria-live="polite">
      <div className="loading-panel">
        <span className="loading-mark" aria-hidden="true" />
        <p className="eyebrow">Checking the demo pantry</p>
        <h1>Loading exact-match evidence…</h1>
        <p>
          Connecting inventory labels to the selected official source record.
        </p>
      </div>
    </main>
  );
}

function MatchEvidence({ detail }: { detail: MatchDetail }) {
  return (
    <div className="evidence-list" aria-label="Exact-match evidence chain">
      <div className="evidence-guide" aria-hidden="true">
        <span>Official source excerpt</span>
        <span>Normalized typed value</span>
        <span>Inventory field</span>
      </div>
      {detail.match.evidence.map((evidence) => (
        <div
          className="evidence-row"
          key={`${evidence.type}-${evidence.inventoryValue}`}
        >
          <div className="source-excerpt" data-label="Official source excerpt">
            “{evidence.sourceEvidence}”
          </div>
          <div
            className="normalized-identifier"
            data-label="Normalized typed value"
          >
            <span>{identifierLabel(evidence.type)}</span>
            <code>{evidence.recallValue}</code>
          </div>
          <div className="inventory-evidence" data-label="Inventory field">
            <span className="check-mark" aria-hidden="true">
              ✓
            </span>
            <code>{evidence.inventoryValue}</code>
            <span>exact</span>
          </div>
        </div>
      ))}
    </div>
  );
}

interface MatchActionProps {
  detail: MatchDetail;
  busy: boolean;
  onUpdate: (
    detail: MatchDetail,
    status: Exclude<MatchStatus, "needs_review">,
    note: string,
  ) => Promise<void>;
}

function MatchAction({ detail, busy, onUpdate }: MatchActionProps) {
  const action = matchActionState(detail.match.status);
  const [note, setNote] = useState(action.defaultNote);

  return (
    <form
      className="action-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onUpdate(detail, action.targetStatus, note);
      }}
    >
      <label htmlFor={`note-${detail.match.id}`}>{action.noteLabel}</label>
      <div className="action-row">
        <input
          id={`note-${detail.match.id}`}
          value={note}
          maxLength={280}
          required
          onChange={(event) => setNote(event.target.value)}
        />
        <button className="primary-button" type="submit" disabled={busy}>
          {busy ? "Saving…" : action.submitLabel}
        </button>
      </div>
      <p>
        This records a pantry workflow action only. It is not a safety or
        compliance determination.
      </p>
    </form>
  );
}

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<ActionName | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await fetchDashboard();
      setSnapshot(data);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The dashboard could not be loaded.",
      );
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!snapshot || busyAction !== null) return;

    const syncRun = snapshot.latestSync;
    if (
      syncRun &&
      syncRun.status !== "queued" &&
      syncRun.status !== "running"
    ) {
      return;
    }

    let cancelled = false;
    const completion = syncRun
      ? waitForSyncRun(syncRun.id)
      : waitForScheduledSync();
    void completion
      .then((completed) => {
        if (!cancelled) setSnapshot(completed);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(
            caught instanceof Error
              ? caught.message
              : "The initial source sync could not be completed.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [busyAction, snapshot]);

  const runAction = useCallback(
    async (action: ActionName, request: () => Promise<unknown>) => {
      setBusyAction(action);
      setError(null);
      try {
        await request();
        await loadDashboard();
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The action could not be completed.",
        );
      } finally {
        setBusyAction(null);
      }
    },
    [loadDashboard],
  );

  const runSyncAction = useCallback(
    async (
      action: "sync" | "reset",
      request: () => Promise<SyncRunAccepted>,
    ) => {
      setBusyAction(action);
      setError(null);
      try {
        const accepted = await request();
        setSnapshot(await waitForSyncRun(accepted.syncRun.id));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "The source sync could not be completed.",
        );
        await loadDashboard();
      } finally {
        setBusyAction(null);
      }
    },
    [loadDashboard],
  );

  const view = useMemo(
    () => (snapshot ? deriveDashboardView(snapshot) : null),
    [snapshot],
  );

  if (initialLoading) return <LoadingState />;

  if (!snapshot || !view) {
    return (
      <main className="page-shell">
        <section className="error-state" role="alert">
          <p className="eyebrow">Dashboard unavailable</p>
          <h1>We couldn’t load the pantry snapshot.</h1>
          <p>{error ?? "The API returned no dashboard data."}</p>
          <button
            className="primary-button"
            onClick={() => void loadDashboard()}
          >
            Try again
          </button>
        </section>
      </main>
    );
  }

  const focusMatch = view.activeMatches[0];

  const handleMatchUpdate = async (
    detail: MatchDetail,
    status: Exclude<MatchStatus, "needs_review">,
    note: string,
  ) => {
    await runAction(`match:${detail.match.id}`, () =>
      updateMatch(detail.match.id, { status, note }),
    );
  };

  return (
    <div className="app-frame">
      <div className="demo-banner">
        <div>
          <strong>Judging demo · fictional inventory</strong>
          <span>
            This models a community-meal pantry’s bulk-preparation supplies and
            actions—never a public alert.
          </span>
        </div>
        <span className="no-login">Judging demo · no login</span>
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Pantry Hold home">
          <span className="brand-mark" aria-hidden="true">
            PH
          </span>
          <span>
            <strong>Pantry Hold</strong>
            <small>Recall triage board</small>
          </span>
        </a>
        <div className="header-actions">
          <SourceFreshness sync={snapshot.latestSync} />
          <button
            className="secondary-button"
            disabled={busyAction !== null}
            onClick={() => void runSyncAction("reset", resetDemo)}
          >
            {busyAction === "reset" ? "Resetting…" : "Reset demo"}
          </button>
          <button
            className="secondary-button sync-button"
            disabled={busyAction !== null}
            onClick={() => void runSyncAction("sync", startSync)}
          >
            {busyAction === "sync" ? "Syncing…" : "Sync source"}
          </button>
        </div>
      </header>

      <main id="top">
        {error ? (
          <div className="inline-error" role="alert">
            <div>
              <strong>That action didn’t finish.</strong>
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        ) : null}

        <section className={`hero ${focusMatch ? "has-match" : "is-clear"}`}>
          <div className="hero-copy">
            <p className="eyebrow">
              {focusMatch
                ? "Possible identifier match"
                : "Exact identifier review"}
            </p>
            <h1>
              {focusMatch
                ? `${view.reviewItems === 1 ? "One" : view.reviewItems} fictional pantry ${plural(view.reviewItems, "item")} ${view.reviewItems === 1 ? "shares" : "share"} an exact product code and lot with the official record.`
                : "No exact identifier match was found in the record checked."}
            </h1>
            <p className="hero-explainer">
              {focusMatch
                ? "Pantry Hold found matching typed identifiers in an official openFDA record. A person still decides what to do next."
                : "This is not a safety determination. Product names are never used to create a hold."}
            </p>

            {focusMatch ? (
              <div
                className="impact-strip"
                aria-label="Fictional inventory under review"
              >
                <div>
                  <strong>{view.reviewUnits}</strong>
                  <span>
                    {plural(
                      view.reviewUnits,
                      focusMatch.inventory.unit.replace(/s$/, ""),
                      focusMatch.inventory.unit,
                    )}{" "}
                    under review
                  </span>
                </div>
                <div>
                  <strong>{view.reviewPortions}</strong>
                  <span>estimated portions in inventory under review</span>
                </div>
                <div>
                  <strong>{focusMatch.inventory.shelf}</strong>
                  <span>pantry location</span>
                </div>
              </div>
            ) : null}
          </div>

          <aside className="decision-card" aria-label="Match decision">
            {focusMatch ? (
              <>
                <div className="decision-heading">
                  <div>
                    <span className={`status-pill ${focusMatch.match.status}`}>
                      {statusLabel(focusMatch.match.status)}
                    </span>
                    <h2>{focusMatch.inventory.name}</h2>
                    <p>
                      {focusMatch.inventory.quantity}{" "}
                      {focusMatch.inventory.unit} · {focusMatch.inventory.shelf}
                    </p>
                  </div>
                  <span className="demo-chip">Demo inventory</span>
                </div>

                <div className="recall-summary">
                  <span>
                    U.S. FDA · fetched {formatDate(focusMatch.recall.fetchedAt)}
                  </span>
                  <strong>{focusMatch.recall.classification}</strong>
                  <p>{focusMatch.recall.productDescription}</p>
                  <a
                    href={focusMatch.recall.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View official source ↗
                  </a>
                </div>

                <div className="evidence-heading">
                  <div>
                    <p className="eyebrow">Why this appeared</p>
                    <h3>Exact typed identifiers</h3>
                  </div>
                  <span>
                    {focusMatch.match.evidence.length} exact identifier{" "}
                    {plural(
                      focusMatch.match.evidence.length,
                      "match",
                      "matches",
                    )}
                  </span>
                </div>
                <MatchEvidence detail={focusMatch} />
                <MatchAction
                  key={matchActionStateKey(
                    focusMatch.match.id,
                    focusMatch.match.status,
                  )}
                  detail={focusMatch}
                  busy={busyAction === `match:${focusMatch.match.id}`}
                  onUpdate={handleMatchUpdate}
                />
              </>
            ) : (
              <div className="clear-state">
                <span className="clear-mark" aria-hidden="true">
                  ✓
                </span>
                <h2>No active possible matches</h2>
                <p>
                  No exact identifier match was found in the record checked.
                  This is not a safety determination.
                </p>
                <button
                  className="primary-button"
                  disabled={busyAction !== null}
                  onClick={() => void runSyncAction("sync", startSync)}
                >
                  Sync official source
                </button>
              </div>
            )}
          </aside>
        </section>

        <section className="trust-bar" aria-label="Matching rules">
          <div>
            <span>01</span>
            <p>
              <strong>Official source</strong>
              U.S. Food and Drug Administration via openFDA, live or cached.
            </p>
          </div>
          <div>
            <span>02</span>
            <p>
              <strong>Exact identifiers only</strong>
              An exact lot and an exact product code or UPC must be identical.
            </p>
          </div>
          <div>
            <span>03</span>
            <p>
              <strong>Human decision</strong>
              The board supports review; it does not determine safety.
            </p>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel inventory-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Fictional inventory</p>
                <h2>What’s in the pantry</h2>
              </div>
              <span>{snapshot.inventory.length} items</span>
            </div>

            {snapshot.inventory.length ? (
              <div className="inventory-list">
                {snapshot.inventory.map((item) => {
                  const itemMatch = snapshot.matches.find(
                    (match) => match.inventoryItemId === item.id,
                  );
                  return (
                    <article className="inventory-item" key={item.id}>
                      <div className="inventory-main">
                        <span className="shelf-label">{item.shelf}</span>
                        <h3>{item.name}</h3>
                        <p>
                          {item.quantity} {item.unit} ·{" "}
                          {item.estimatedMealPortions} estimated portions
                        </p>
                      </div>
                      <div className="inventory-identifiers">
                        {item.identifiers.map((identifier) => (
                          <span key={`${identifier.type}-${identifier.value}`}>
                            {identifierLabel(identifier.type)}{" "}
                            <code>{identifier.displayValue}</code>
                          </span>
                        ))}
                      </div>
                      <span
                        className={`inventory-result ${itemMatch?.status ?? "no_match"}`}
                      >
                        {itemMatch
                          ? statusLabel(itemMatch.status)
                          : "No exact match"}
                      </span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <h3>No demo inventory</h3>
                <p>Reset the demo to restore the fictional pantry items.</p>
              </div>
            )}
          </div>

          <div className="side-stack">
            <section className="panel source-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Evidence provenance</p>
                  <h2>Source record</h2>
                </div>
              </div>
              {focusMatch ? (
                <dl className="source-details">
                  <div>
                    <dt>Source</dt>
                    <dd>U.S. FDA · openFDA food enforcement</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>{syncModeLabel(snapshot.latestSync)}</dd>
                  </div>
                  <div>
                    <dt>Fetched</dt>
                    <dd>{formatDate(focusMatch.recall.fetchedAt)}</dd>
                  </div>
                  <div>
                    <dt>Reported</dt>
                    <dd>{formatReportDate(focusMatch.recall.reportDate)}</dd>
                  </div>
                  <div>
                    <dt>Record status</dt>
                    <dd>{focusMatch.recall.status}</dd>
                  </div>
                  <div>
                    <dt>Raw SHA-256</dt>
                    <dd>
                      <code title={focusMatch.recall.rawSha256}>
                        {focusMatch.recall.rawSha256.slice(0, 16)}…
                      </code>
                    </dd>
                  </div>
                </dl>
              ) : (
                <div className="empty-state compact">
                  <p>No recall record is attached to an active match.</p>
                </div>
              )}
            </section>

            <section className="panel audit-panel">
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">Human workflow</p>
                  <h2>Audit timeline</h2>
                </div>
                <span>
                  {snapshot.audit.length}{" "}
                  {plural(snapshot.audit.length, "event")}
                </span>
              </div>
              {snapshot.audit.length ? (
                <ol className="timeline">
                  {[...snapshot.audit]
                    .sort(
                      (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                    )
                    .map((entry) => (
                      <li key={entry.id}>
                        <span className="timeline-dot" aria-hidden="true" />
                        <div>
                          <strong>{auditLabel(entry)}</strong>
                          <time dateTime={entry.createdAt}>
                            {formatDate(entry.createdAt)}
                          </time>
                          <p>{entry.note}</p>
                        </div>
                      </li>
                    ))}
                </ol>
              ) : (
                <div className="empty-state compact">
                  <p>
                    No actions recorded yet. Match and hold events appear here.
                  </p>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>

      <footer>
        <div>
          <strong>Pantry Hold</strong>
          <span>
            One deterministic official-record demonstration proving the full
            pipeline—not comprehensive recall coverage.
          </span>
        </div>
        <p>{snapshot.disclaimer}</p>
      </footer>
    </div>
  );
}
