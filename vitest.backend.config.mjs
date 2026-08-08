export default {
  root: ".",
  test: {
    include: [
      "apps/api/**/*.test.ts",
      "apps/worker/**/*.test.ts",
      "packages/core/**/*.test.ts",
      "packages/db/**/*.test.ts",
    ],
  },
};
