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

    const node22Count = block.match(/^ {6}base: nodejs@22\s*$/gm)?.length ?? 0;
    if (node22Count !== 2) {
      errors.push(`${setup} must pin both build and runtime to nodejs@22`);
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
  }

  const app = blocks.find(({ setup }) => setup === "app")?.text ?? "";
  requirePattern(
    errors,
    app,
    /^ {8}- port: 3000\n {10}protocol: TCP\n {10}httpSupport: true$/m,
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
    /^ {10}path: \/api\/health\s*$/m,
    "app checks must target /api/health",
  );

  const worker = blocks.find(({ setup }) => setup === "worker")?.text ?? "";
  if (/^ {6}ports:/m.test(worker)) {
    errors.push("worker must remain private and must not declare a port");
  }
  requirePattern(
    errors,
    worker,
    /^ {6}start: npm run start:worker\s*$/m,
    "worker must start the background worker service",
  );
  requirePattern(
    errors,
    worker,
    /^ {8}OPENFDA_SOURCE_MODE: cached_official_fixture\s*$/m,
    "worker must identify the bundled record as a cached official fixture",
  );

  return errors;
}

async function main() {
  const configPath = process.argv[2] ?? "zerops.yaml";
  const source = await readFile(configPath, "utf8");
  const errors = validateZeropsConfig(source);

  if (errors.length > 0) {
    console.error(`Invalid ${configPath}:`);
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `Validated ${configPath}: app is public-capable; worker is private; both use Node 22, checks, and the db service reference.`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main();
}
