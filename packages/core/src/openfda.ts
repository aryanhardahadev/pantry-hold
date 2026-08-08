import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { extractExplicitIdentifiers } from "./matching.js";
import type { RecallRecord, SyncRun } from "./types.js";

export interface OpenFdaEnforcementRecord {
  recall_number: string;
  report_date: string;
  classification: string;
  status: string;
  product_description: string;
  code_info: string;
  reason_for_recall: string;
  distribution_pattern: string;
  [key: string]: unknown;
}

export interface OpenFdaLoadResult {
  records: RecallRecord[];
  sourceMode: SyncRun["sourceMode"];
}

export interface LoadOpenFdaOptions {
  recallNumber?: string;
  fixturePath: string;
  fetchImpl?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>;
  now?: () => Date;
  timeoutMs?: number;
  onFallback?: (reason: string) => void;
}

interface CachedFixture {
  fixtureMetadata: {
    source: string;
    sourceUrl: string;
    fetchedAt: string;
    usage: string;
  };
  record: OpenFdaEnforcementRecord;
}

const defaultRecallNumber = "H-1180-2026";

export async function loadOpenFdaRecall(
  options: LoadOpenFdaOptions,
): Promise<OpenFdaLoadResult> {
  const recallNumber = options.recallNumber ?? defaultRecallNumber;
  const sourceUrl = buildOpenFdaUrl(recallNumber);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const now = options.now ?? (() => new Date());

  try {
    const response = await fetchImpl(sourceUrl, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? 8_000),
    });
    if (!response.ok) {
      throw new Error(`openFDA returned HTTP ${response.status}.`);
    }

    const payload: unknown = await response.json();
    const records = parseLiveResults(payload).filter(
      (record) => record.recall_number === recallNumber,
    );
    if (records.length === 0) {
      throw new Error(`openFDA returned no exact ${recallNumber} record.`);
    }

    const fetchedAt = now().toISOString();
    return {
      records: records.map((record) =>
        normalizeOpenFdaRecord(record, sourceUrl, fetchedAt),
      ),
      sourceMode: "live",
    };
  } catch (error) {
    options.onFallback?.(errorMessage(error));
    return loadCachedFixture(options.fixturePath, recallNumber);
  }
}

export function normalizeOpenFdaRecord(
  record: OpenFdaEnforcementRecord,
  sourceUrl: string,
  fetchedAt: string,
): RecallRecord {
  return {
    id: record.recall_number,
    source: "openfda",
    sourceUrl,
    fetchedAt,
    reportDate: formatOpenFdaDate(record.report_date),
    classification: record.classification,
    status: record.status,
    productDescription: record.product_description,
    codeInfo: record.code_info,
    reasonForRecall: record.reason_for_recall,
    distributionPattern: record.distribution_pattern,
    identifiers: extractExplicitIdentifiers({
      productDescription: record.product_description,
      codeInfo: record.code_info,
    }),
    rawSha256: createHash("sha256")
      .update(JSON.stringify(record))
      .digest("hex"),
  };
}

export function buildOpenFdaUrl(recallNumber: string): string {
  const url = new URL("https://api.fda.gov/food/enforcement.json");
  url.searchParams.set("search", `recall_number:"${recallNumber}"`);
  url.searchParams.set("limit", "1");
  return url.toString();
}

async function loadCachedFixture(
  fixturePath: string,
  recallNumber: string,
): Promise<OpenFdaLoadResult> {
  const parsed: unknown = JSON.parse(await readFile(fixturePath, "utf8"));
  const fixture = parseCachedFixture(parsed);
  if (fixture.record.recall_number !== recallNumber) {
    throw new Error(
      `Cached official fixture is for ${fixture.record.recall_number}, not ${recallNumber}.`,
    );
  }

  return {
    records: [
      normalizeOpenFdaRecord(
        fixture.record,
        fixture.fixtureMetadata.sourceUrl,
        fixture.fixtureMetadata.fetchedAt,
      ),
    ],
    sourceMode: "cached_official_fixture",
  };
}

function parseLiveResults(value: unknown): OpenFdaEnforcementRecord[] {
  if (!isObject(value) || !Array.isArray(value.results)) {
    throw new Error("openFDA response did not contain a results array.");
  }
  return value.results.map((record, index) => parseRecord(record, index));
}

function parseCachedFixture(value: unknown): CachedFixture {
  if (
    !isObject(value) ||
    !isObject(value.fixtureMetadata) ||
    typeof value.fixtureMetadata.source !== "string" ||
    value.fixtureMetadata.source !== "openFDA food enforcement API" ||
    typeof value.fixtureMetadata.sourceUrl !== "string" ||
    !value.fixtureMetadata.sourceUrl.startsWith(
      "https://api.fda.gov/food/enforcement.json",
    ) ||
    typeof value.fixtureMetadata.fetchedAt !== "string" ||
    typeof value.fixtureMetadata.usage !== "string"
  ) {
    throw new Error(
      "Cached openFDA fixture metadata is invalid or unlabelled.",
    );
  }

  return {
    fixtureMetadata: {
      source: value.fixtureMetadata.source,
      sourceUrl: value.fixtureMetadata.sourceUrl,
      fetchedAt: value.fixtureMetadata.fetchedAt,
      usage: value.fixtureMetadata.usage,
    },
    record: parseRecord(value.record, 0),
  };
}

function parseRecord(value: unknown, index: number): OpenFdaEnforcementRecord {
  if (!isObject(value)) {
    throw new Error(`openFDA result ${index} must be an object.`);
  }

  const requiredFields = [
    "recall_number",
    "report_date",
    "classification",
    "status",
    "product_description",
    "code_info",
    "reason_for_recall",
    "distribution_pattern",
  ] as const;
  for (const field of requiredFields) {
    if (typeof value[field] !== "string") {
      throw new Error(`openFDA result ${index}.${field} must be a string.`);
    }
  }

  return value as OpenFdaEnforcementRecord;
}

function formatOpenFdaDate(value: string): string {
  if (/^\d{8}$/.test(value)) {
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  }
  return value;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
