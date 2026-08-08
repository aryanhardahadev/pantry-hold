import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const processHandle = spawn("codex.exe", ["app-server"], {
  stdio: ["pipe", "pipe", "inherit"],
  windowsHide: true,
});

const lines = createInterface({ input: processHandle.stdout });
const timeout = setTimeout(() => {
  console.error("Timed out while reading Codex rate limits.");
  processHandle.kill();
  process.exitCode = 2;
}, 20_000);

const send = (message) => {
  processHandle.stdin.write(`${JSON.stringify(message)}\n`);
};

lines.on("line", (line) => {
  const message = JSON.parse(line);

  if (message.id === 0 && message.result) {
    send({ method: "initialized", params: {} });
    send({ method: "account/rateLimits/read", id: 1 });
    return;
  }

  if (message.id === 1) {
    clearTimeout(timeout);
    const payload = message.result ?? message.error;
    console.log(JSON.stringify(payload, null, 2));

    const buckets = Object.values(
      payload?.rateLimitsByLimitId ??
        (payload?.rateLimits
          ? { [payload.rateLimits.limitId]: payload.rateLimits }
          : {}),
    );
    const highestUsedPercent = Math.max(
      0,
      ...buckets.map((bucket) => bucket?.primary?.usedPercent ?? 0),
    );

    if (highestUsedPercent >= 99) {
      console.error(
        `STOP: Codex quota is ${highestUsedPercent}% used (threshold: 99%).`,
      );
      process.exitCode = 99;
    } else if (highestUsedPercent >= 85) {
      console.error(
        `HANDOFF: Codex quota is ${highestUsedPercent}% used (15% or less remains). ` +
          "Do not spawn new Codex-heavy work; prepare the approved sol-orchestrator Grok fallback.",
      );
      process.exitCode = 85;
    }

    processHandle.stdin.end();
  }
});

processHandle.on("error", (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exitCode = 1;
});

processHandle.on("exit", (code) => {
  clearTimeout(timeout);
  if (code && process.exitCode === undefined) {
    process.exitCode = code;
  }
});

send({
  method: "initialize",
  id: 0,
  params: {
    clientInfo: {
      name: "zerops_hackathon_usage_guard",
      title: "Zerops Hackathon Usage Guard",
      version: "0.1.0",
    },
  },
});
