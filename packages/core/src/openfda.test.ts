import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildOpenFdaUrl,
  loadOpenFdaRecall,
  type OpenFdaEnforcementRecord,
} from "./openfda.js";

const liveRecord: OpenFdaEnforcementRecord = {
  recall_number: "H-1180-2026",
  report_date: "20260729",
  classification: "Class I",
  status: "Ongoing",
  product_description:
    "Organic Moringa Powder; 15kg/bag (bulk); Product code: GJ96",
  code_info: "lot: 25/08001 Expiration date: 02-11-2028",
  reason_for_recall: "Official record reason",
  distribution_pattern: "Official record distribution",
};

describe("openFDA loading", () => {
  it("normalizes the live official response with provenance and a raw hash", async () => {
    let requestedUrl = "";
    const loaded = await loadOpenFdaRecall({
      fixturePath: resolve("fixtures/openfda/H-1180-2026.json"),
      now: () => new Date("2026-08-09T12:00:00.000Z"),
      fetchImpl: async (input) => {
        requestedUrl = String(input);
        return new Response(JSON.stringify({ results: [liveRecord] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    });

    expect(requestedUrl).toBe(buildOpenFdaUrl("H-1180-2026"));
    expect(loaded.sourceMode).toBe("live");
    expect(loaded.records).toHaveLength(1);
    expect(loaded.records[0]).toMatchObject({
      id: "H-1180-2026",
      source: "openfda",
      sourceUrl: requestedUrl,
      fetchedAt: "2026-08-09T12:00:00.000Z",
      reportDate: "2026-07-29",
      rawSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      identifiers: [
        expect.objectContaining({ type: "product_code", value: "GJ96" }),
        expect.objectContaining({ type: "lot", value: "25/08001" }),
      ],
    });
  });

  it("falls back only to the clearly labelled cached official fixture", async () => {
    const reasons: string[] = [];
    const loaded = await loadOpenFdaRecall({
      fixturePath: resolve("fixtures/openfda/H-1180-2026.json"),
      fetchImpl: async () => {
        throw new Error("network unavailable");
      },
      onFallback: (reason) => reasons.push(reason),
    });

    expect(reasons).toEqual(["network unavailable"]);
    expect(loaded.sourceMode).toBe("cached_official_fixture");
    expect(loaded.records[0]).toMatchObject({
      id: "H-1180-2026",
      source: "openfda",
      sourceUrl:
        "https://api.fda.gov/food/enforcement.json?search=recall_number:%22H-1180-2026%22&limit=1",
      fetchedAt: "2026-08-08T19:22:00.000Z",
    });
  });
});
