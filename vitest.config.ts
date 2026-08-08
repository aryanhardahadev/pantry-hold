import { defineConfig } from "vitest/config";

export default defineConfig({
  root: ".",
  test: {
    include: ["apps/**/*.test.{ts,tsx,mjs}", "packages/**/*.test.ts"],
  },
});
