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

describe("delivery contract", () => {
  it("keeps the Zerops topology deterministic and secret-free", () => {
    expect(validateZeropsConfig(zeropsSource)).toEqual([]);
    expect(validateZeropsImportConfig(zeropsImportSource)).toEqual([]);
  });

  it("publishes the product and data boundaries", () => {
    expect(readmeSource).toMatch(/fictional demo pantry/i);
    expect(readmeSource).toMatch(/exact typed identifiers/i);
    expect(readmeSource).toMatch(/never uses fuzzy product-name matching/i);
    expect(readmeSource).toMatch(/does not determine whether food is safe/i);
  });

  it("uses review language without safety-like impact or verification claims", () => {
    expect(appSource).not.toMatch(/\baffected\b/i);
    expect(appSource).not.toMatch(/\bverified\b/i);
    expect(appSource).toMatch(/fictional pantry/i);
    expect(appSource).toMatch(/exact product code and lot/i);
    expect(appSource).toMatch(/not comprehensive recall coverage/i);
  });
});
