import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  validateZeropsConfig,
  validateZeropsImportConfig,
} from "../../scripts/validate-config.mjs";

const zeropsSource = await readFile(
  new URL("../../zerops.yaml", import.meta.url),
  "utf8",
);
const zeropsImportSource = await readFile(
  new URL("../../zerops-import.yaml", import.meta.url),
  "utf8",
);
const readmeSource = await readFile(
  new URL("../../README.md", import.meta.url),
  "utf8",
);
const appSource = await readFile(
  new URL("./src/App.tsx", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  await readFile(new URL("../../package.json", import.meta.url), "utf8"),
);

describe("delivery contract", () => {
  it("keeps the Zerops topology deterministic and secret-free", () => {
    expect(validateZeropsConfig(zeropsSource)).toEqual([]);
    expect(validateZeropsImportConfig(zeropsImportSource)).toEqual([]);
  });

  it("rejects app and worker readiness or health endpoint drift", () => {
    const drifted = zeropsSource
      .replaceAll("          path: /readyz", "          path: /api/health")
      .replaceAll("          path: /healthz", "          path: /api/health");

    expect(validateZeropsConfig(drifted)).toEqual(
      expect.arrayContaining([
        "app deployment readiness must target port 3000 /readyz",
        "app runtime health must target port 3000 /healthz",
        "worker deployment readiness must target port 3001 /readyz",
        "worker runtime health must target port 3001 /healthz",
      ]),
    );
  });

  it("rejects optional timing overrides before schema or decoder drift", () => {
    const numericDurations = zeropsSource.replaceAll(
      "          path: /healthz",
      "          path: /healthz\n        failureTimeout: 60\n        disconnectTimeout: 30\n        recoveryTimeout: 30\n        execPeriod: 10",
    );

    expect(validateZeropsConfig(numericDurations)).toEqual(
      expect.arrayContaining([
        "app must omit optional check timings and use platform defaults",
        "worker must omit optional check timings and use platform defaults",
      ]),
    );
  });

  it("rejects legacy runtime schema values and dependent-first imports", () => {
    const legacyRuntime = zeropsSource
      .replaceAll("base: alpine/nodejs@22", "base: nodejs@22")
      .replace(
        "        - port: 3000\n          httpSupport: true",
        "        - port: 3000\n          protocol: TCP\n          httpSupport: true",
      )
      .replace(
        "        - port: 3001\n          httpSupport: true",
        "        - port: 3001\n          protocol: TCP\n          httpSupport: true",
      );
    const dependentFirstImport = zeropsImportSource.replace(
      "    priority: 3",
      "    priority: 1",
    );

    expect(validateZeropsConfig(legacyRuntime)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("schema-valid alpine/nodejs@22"),
        "app must expose HTTP port 3000 for public access",
        "worker must declare its internal HTTP health port 3001",
      ]),
    );
    expect(validateZeropsImportConfig(dependentFirstImport)).toContain(
      "db import priority must exceed app and worker priorities",
    );
  });

  it("publishes the product and data boundaries", () => {
    expect(readmeSource).toMatch(/fictional demo pantry/i);
    expect(readmeSource).toMatch(/exact typed identifiers/i);
    expect(readmeSource).toMatch(/exact lot AND an exact product code or UPC/i);
    expect(readmeSource).not.toMatch(/product-code or lot intersection/i);
    expect(readmeSource).toMatch(/never uses fuzzy product-name matching/i);
    expect(readmeSource).toMatch(/does not determine whether food is safe/i);
  });

  it("uses review language without safety-like impact or verification claims", () => {
    expect(appSource).not.toMatch(/\baffected\b/i);
    expect(appSource).not.toMatch(/\bverified\b/i);
    expect(appSource).toMatch(/fictional pantry/i);
    expect(appSource).toMatch(/exact product code and lot/i);
    expect(appSource).toMatch(/selected official source record/i);
    expect(appSource).not.toMatch(/latest available source record/i);
    expect(appSource).toMatch(/not comprehensive recall coverage/i);
  });

  it("keeps persistent local services outside watch mode", () => {
    expect(packageJson.scripts.dev).toContain("npm:dev:web");
    expect(packageJson.scripts["dev:web"]).toBe("vite");
    expect(packageJson.scripts["dev:services"]).toContain(
      "apps/dev/src/index.ts",
    );
    expect(packageJson.scripts["dev:services"]).not.toMatch(
      /--watch(?:\s|=|$)/,
    );
  });
});
