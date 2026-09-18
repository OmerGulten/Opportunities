import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    // Structured logs are verbose by design; keep test output readable.
    env: { LOG_LEVEL: "error" },
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    globals: false,
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/features/**"],
    },
  },
});
