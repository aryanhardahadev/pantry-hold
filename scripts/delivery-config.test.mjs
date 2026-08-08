import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  validateZeropsConfig,
  validateZeropsImportConfig,
} from "./validate-config.mjs";

const zeropsSource = await readFile("zerops.yaml", "utf8");
const zeropsImportSource = await readFile("zerops-import.yaml", "utf8");
const workflowSource = await readFile(".github/workflows/ci.yml", "utf8");
const readmeSource = await readFile("README.md", "utf8");

test("Zerops configuration satisfies the delivery contract", () => {
  assert.deepEqual(validateZeropsConfig(zeropsSource), []);
});

test("validator rejects missing worker health and a literal database credential", () => {
  const invalid = zeropsSource
    .replace(
      "        DATABASE_URL: ${db_connectionString}\n        OPENFDA_FIXTURE_PATH",
      "        DATABASE_PASSWORD: definitely-not-a-secret\n        DATABASE_URL: postgresql://db:password@db:5432/db\n        OPENFDA_FIXTURE_PATH",
    )
    .replace(
      "          port: 3001\n          path: /healthz",
      "          port: 3001\n          path: /wrong-worker-health",
    );

  const errors = validateZeropsConfig(invalid);
  assert.ok(errors.some((error) => error.includes("literal secrets")));
  assert.ok(errors.some((error) => error.includes("db_connectionString")));
  assert.ok(errors.some((error) => error.includes("worker runtime health")));
});

test("Zerops import pins the approved private, minimum-resource topology", () => {
  assert.deepEqual(validateZeropsImportConfig(zeropsImportSource), []);
});

test("import validator rejects a public worker and invalid CPU minimum", () => {
  const invalid = zeropsImportSource
    .replace("enableSubdomainAccess: false", "enableSubdomainAccess: true")
    .replace("minCpu: 1", "minCpu: 0.5");
  const errors = validateZeropsImportConfig(invalid);

  assert.ok(errors.some((error) => error.includes("worker must explicitly")));
  assert.ok(errors.some((error) => error.includes("official minima")));
});

test("import validator rejects new-project semantics", () => {
  const invalid = `project:\n  name: pantry-hold\n  corePackage: LIGHT\n${zeropsImportSource}`;
  assert.ok(
    validateZeropsImportConfig(invalid).some((error) =>
      error.includes("must not define a project"),
    ),
  );
});

test("CI includes every required gate and no deployment trigger", () => {
  for (const command of [
    "npm run format:check",
    "npm run lint",
    "npm run typecheck",
    "npm test",
    "npm run build",
    "npm audit --omit=dev --audit-level=high",
  ]) {
    assert.match(workflowSource, new RegExp(command.replaceAll(" ", "\\s+")));
  }

  assert.doesNotMatch(workflowSource, /deploy|zcli/i);
});

test("README states the exact-match, fictional-data, and source boundaries", () => {
  assert.match(readmeSource, /fictional demo pantry/i);
  assert.match(readmeSource, /exact typed identifiers/i);
  assert.match(readmeSource, /never uses fuzzy product-name matching/i);
  assert.match(readmeSource, /cached copy of an official openFDA response/i);
  assert.match(readmeSource, /does not determine whether food is safe/i);
});
