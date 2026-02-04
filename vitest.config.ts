import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/fixtures/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"], // Exclude server entry point
    },
    testTimeout: 60000, // Git operations can be slow
    hookTimeout: 60000, // Setup/teardown can be slow with git
  },
});
