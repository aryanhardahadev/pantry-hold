import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validateZeropsConfig } from "./validate-config.mjs";

const zeropsSource = await readFile("zerops.yaml", "utf8");
const workflowSource = await readFile(".github/workflows/ci.yml", "utf8");
const readmeSource = await readFile("README.md", "utf8");

test("Zerops configuration satisfies the delivery contract", () => {
  assert.deepEqual(validateZeropsConfig(zeropsSource), []);
});

test("validator rejects a public worker and a literal database credential", () => {
  const invalid = zeropsSource.replace(
    "    run:\n      base: nodejs@22\n      envVariables:\n        NODE_ENV: production\n        DATABASE_URL: ${db_connectionString}",
    "    run:\n      base: nodejs@22\n      ports:\n        - port: 3001\n      envVariables:\n        NODE_ENV: production\n        DATABASE_PASSWORD: definitely-not-a-secret\n        DATABASE_URL: postgresql://db:password@db:5432/db",
  );

  const errors = validateZeropsConfig(invalid);
  assert.ok(errors.some((error) => error.includes("literal secrets")));
  assert.ok(
    errors.some((error) => error.includes("worker must remain private")),
  );
  assert.ok(errors.some((error) => error.includes("db_connectionString")));
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
