import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const serviceStartPattern = /^ {2}- setup: ([a-z0-9]+)\s*$/;

function serviceBlocks(source) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const starts = [];

  for (const [index, line] of lines.entries()) {
    const match = line.match(serviceStartPattern);
    if (match) starts.push({ index, setup: match[1] });
  }

  return starts.map(({ index, setup }, position) => ({
    setup,
    text: lines
      .slice(index, starts[position + 1]?.index ?? lines.length)
      .join("\n"),
  }));
}

function requirePattern(errors, text, pattern, message) {
  if (!pattern.test(text)) errors.push(message);
}

export function validateZeropsConfig(source) {
  const errors = [];
  const blocks = serviceBlocks(source);
  const setups = blocks.map(({ setup }) => setup);

  if (!/^zerops:\s*$/m.test(source)) {
    errors.push("zerops.yaml must contain a top-level zerops key");
  }

  if (setups.join(",") !== "app,worker") {
    errors.push("zerops.yaml must define exactly the app and worker setups");
  }

  const literalSecretPattern =
    /^\s+(?:.*(?:PASSWORD|PASS|TOKEN|SECRET|API_KEY).*):\s+(?!\$\{)[^#\s].*$/gim;
  if (literalSecretPattern.test(source)) {
    errors.push("zerops.yaml must not contain literal secrets");
  }

  for (const setup of ["app", "worker"]) {
    const block = blocks.find((candidate) => candidate.setup === setup)?.text;
    if (!block) continue;

    const node22Count =
      block.match(/^ {6}base: alpine\/nodejs@22\s*$/gm)?.length ?? 0;
    if (node22Count !== 2) {
      errors.push(
        `${setup} must pin both build and runtime to schema-valid alpine/nodejs@22`,
      );
    }

    requirePattern(
      errors,
      block,
      /^ {8}- npm ci\s*$/m,
      `${setup} must install the lockfile with npm ci`,
    );
    requirePattern(
      errors,
      block,
      /^ {8}- npm run build\s*$/m,
      `${setup} must run the production build`,
    );
    requirePattern(
      errors,
      block,
      /^ {8}- fixtures\s*$/m,
      `${setup} must deploy the checked demo fixtures`,
    );
    requirePattern(
      errors,
      block,
      /^ {8}DATABASE_URL: \$\{db_connectionString\}\s*$/m,
      `${setup} must reference db_connectionString through DATABASE_URL`,
    );
    requirePattern(
      errors,
      block,
      /^ {4}deploy:\n {6}readinessCheck:/m,
      `${setup} must define a deployment readiness check`,
    );
    requirePattern(
      errors,
      block,
      /^ {6}healthCheck:/m,
      `${setup} must define a runtime health check`,
    );
    if (
      /^ {8}(?:failureTimeout|disconnectTimeout|recoveryTimeout|execPeriod|retryPeriod):/m.test(
        block,
      )
    ) {
      errors.push(
        `${setup} must omit optional check timings and use platform defaults`,
      );
    }
  }

  const app = blocks.find(({ setup }) => setup === "app")?.text ?? "";
  requirePattern(
    errors,
    app,
    /^ {8}- port: 3000\n(?: {10}protocol: tcp\n)? {10}httpSupport: true$/m,
    "app must expose HTTP port 3000 for public access",
  );
  requirePattern(
    errors,
    app,
    /^ {6}start: npm run start:api\s*$/m,
    "app must start the API service",
  );
  requirePattern(
    errors,
    app,
    /^ {4}deploy:\n {6}readinessCheck:\n {8}httpGet:\n {10}port: 3000\n {10}path: \/readyz\s*$/m,
    "app deployment readiness must target port 3000 /readyz",
  );
  requirePattern(
    errors,
    app,
    /^ {6}healthCheck:\n {8}httpGet:\n {10}port: 3000\n {10}path: \/healthz\s*$/m,
    "app runtime health must target port 3000 /healthz",
  );

  const worker = blocks.find(({ setup }) => setup === "worker")?.text ?? "";
  requirePattern(
    errors,
    worker,
    /^ {6}start: npm run start:worker\s*$/m,
    "worker must start the background worker service",
  );
  requirePattern(
    errors,
    worker,
    /^ {8}- port: 3001\n(?: {10}protocol: tcp\n)? {10}httpSupport: true$/m,
    "worker must declare its internal HTTP health port 3001",
  );
  requirePattern(
    errors,
    worker,
    /^ {4}deploy:\n {6}readinessCheck:\n {8}httpGet:\n {10}port: 3001\n {10}path: \/readyz\s*$/m,
    "worker deployment readiness must target port 3001 /readyz",
  );
  requirePattern(
    errors,
    worker,
    /^ {6}healthCheck:\n {8}httpGet:\n {10}port: 3001\n {10}path: \/healthz\s*$/m,
    "worker runtime health must target port 3001 /healthz",
  );

  return errors;
}

const importServiceStartPattern = /^ {2}- hostname: ([a-z0-9]+)\s*$/;

function importServiceBlocks(source) {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const starts = [];

  for (const [index, line] of lines.entries()) {
    const match = line.match(importServiceStartPattern);
    if (match) starts.push({ index, hostname: match[1] });
  }

  return starts.map(({ index, hostname }, position) => ({
    hostname,
    text: lines
      .slice(index, starts[position + 1]?.index ?? lines.length)
      .join("\n"),
  }));
}

export function validateZeropsImportConfig(source) {
  const errors = [];
  const blocks = importServiceBlocks(source);
  const hostnames = blocks.map(({ hostname }) => hostname);
  const repository = "https://github.com/aryanhardahadev/pantry-hold";

  if (hostnames.join(",") !== "app,worker,db") {
    errors.push("zerops-import.yaml must define exactly app, worker, and db");
  }
  if (/^project:\s*$/m.test(source) || /^ {2}corePackage:/m.test(source)) {
    errors.push("existing-project service import must not define a project");
  }
  if (/\b(?:ZCP|addon|dedicatedIp)\b/i.test(source)) {
    errors.push("import must not enable ZCP, add-ons, or a dedicated IP");
  }

  for (const hostname of ["app", "worker"]) {
    const block = blocks.find(
      (candidate) => candidate.hostname === hostname,
    )?.text;
    if (!block) continue;

    requirePattern(
      errors,
      block,
      /^ {4}type: alpine\/nodejs@22\s*$/m,
      `${hostname} import type must be schema-valid Alpine Node.js 22`,
    );
    requirePattern(
      errors,
      block,
      /^ {4}mode: NON_HA\s*$/m,
      `${hostname} must use NON_HA mode`,
    );
    requirePattern(
      errors,
      block,
      new RegExp(
        `^ {4}buildFromGit: ${repository.replaceAll("/", "\\/")}\\s*$`,
        "m",
      ),
      `${hostname} must build from the public Pantry Hold repository`,
    );
    requirePattern(
      errors,
      block,
      new RegExp(`^ {4}zeropsSetup: ${hostname}\\s*$`, "m"),
      `${hostname} must select its matching zerops.yaml setup`,
    );
    requirePattern(
      errors,
      block,
      /^ {4}minContainers: 1\n {4}maxContainers: 1\s*$/m,
      `${hostname} must use exactly one container`,
    );
    requireFixedMinimumResources(errors, block, hostname);
  }

  const app = blocks.find(({ hostname }) => hostname === "app")?.text ?? "";
  requirePattern(
    errors,
    app,
    /^ {4}enableSubdomainAccess: true\s*$/m,
    "app must enable public Zerops subdomain access",
  );

  const worker =
    blocks.find(({ hostname }) => hostname === "worker")?.text ?? "";
  requirePattern(
    errors,
    worker,
    /^ {4}enableSubdomainAccess: false\s*$/m,
    "worker must explicitly disable public subdomain access",
  );

  const db = blocks.find(({ hostname }) => hostname === "db")?.text ?? "";
  requirePattern(
    errors,
    db,
    /^ {4}type: postgresql:single@18\s*$/m,
    "db must use single-container PostgreSQL 18",
  );
  requirePattern(
    errors,
    db,
    /^ {4}enableSubdomainAccess: false\s*$/m,
    "db must explicitly disable public subdomain access",
  );
  if (/^ {4}(?:minContainers|maxContainers):/m.test(db)) {
    errors.push("db container count must come from the postgresql:single type");
  }
  requireFixedMinimumResources(errors, db, "db");

  const appPriority = importPriority(app);
  const workerPriority = importPriority(worker);
  const dbPriority = importPriority(db);
  if (
    appPriority === null ||
    workerPriority === null ||
    dbPriority === null ||
    dbPriority <= appPriority ||
    dbPriority <= workerPriority
  ) {
    errors.push("db import priority must exceed app and worker priorities");
  }

  return errors;
}

function importPriority(block) {
  const value = block.match(/^ {4}priority: (\d+)\s*$/m)?.[1];
  return value === undefined ? null : Number(value);
}

function requireFixedMinimumResources(errors, block, hostname) {
  requirePattern(
    errors,
    block,
    /^ {4}verticalAutoscaling:\n {6}cpuMode: SHARED\n {6}minCpu: 1\n {6}maxCpu: 1\n {6}minRam: 0\.25\n {6}maxRam: 0\.25\n {6}minDisk: 1\n {6}maxDisk: 1\s*$/m,
    `${hostname} must pin SHARED CPU, RAM, and disk to official minima`,
  );
}

async function main() {
  const configPath = process.argv[2] ?? "zerops.yaml";
  const source = await readFile(configPath, "utf8");
  const errors = configPath.endsWith("zerops-import.yaml")
    ? validateZeropsImportConfig(source)
    : validateZeropsConfig(source);

  if (errors.length > 0) {
    console.error(`Invalid ${configPath}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    configPath.endsWith("zerops-import.yaml")
      ? `Validated ${configPath}: app, private worker, and private PostgreSQL 18 are pinned to one minimum-resource container each.`
      : `Validated ${configPath}: app and private worker use Node 22, HTTP checks, and the shared db service reference.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
