import path from "node:path";
import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: "default",
    coverage: {
      reporter: ["text", "cobertura", "lcov"],
      provider: "v8",
      reportOnFailure: true,
      exclude: [
        ...defaultExclude,
        "src/test/**/*",
        "src/migrations/**/*",
        "**/.yalc/**/*",
      ],
    },
    include: [
      "./src/@(test?(s)|__test?(s)__)/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
    ],
    exclude: ["./src/**/@(fixture*(s)|dist|node_modules)/**"],
    maxConcurrency: 5,
    testTimeout: 30000, // Timeout in milliseconds (30 seconds)
    globalSetup: "./src/test/setup-tests.ts",
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
});
