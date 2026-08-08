import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { validateZeropsConfig } from "../../scripts/validate-config.mjs";

const zeropsSource = await readFile(
  new URL("../../zerops.yaml", import.meta.url),
  "utf8",
);
const readmeSource = await readFile(
  new URL("../../README.md", import.meta.url),
  "utf8",
);

describe("delivery contract", () => {
  it("keeps the Zerops topology deterministic and secret-free", () => {
    expect(validateZeropsConfig(zeropsSource)).toEqual([]);
  });

  it("publishes the product and data boundaries", () => {
    expect(readmeSource).toMatch(/fictional demo pantry/i);
    expect(readmeSource).toMatch(/exact typed identifiers/i);
    expect(readmeSource).toMatch(/never uses fuzzy product-name matching/i);
    expect(readmeSource).toMatch(/does not determine whether food is safe/i);
  });
});
