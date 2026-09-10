import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: "default",
    coverage: {
      reporter: ["text", "cobertura", "lcov"],
      provider: "v8",
      reportOnFailure: true,
      // Without an explicit include, the denominator is only the files the
      // tests happened to load, so untested modules are invisible and the
      // percentage shifts with the environment.
      include: ["src/**/*.ts"],
      // Ratchet floors, set below the measured numbers so they catch
      // regression rather than block the build. Raise them as coverage grows.
      // Measured locally: 81.79 lines / 81.73 statements / 86.62 functions / 73.07 branches.
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 85,
        branches: 71,
      },
      exclude: [
        ...defaultExclude,
        "src/test/**/*",
        ".**/**/*.js",
        ".**/**/*.ts",
        "perf/**/*.js",
        "src/migrations/**/*.ts",
        "src/migrations/**/*.js",
      ],
    },
    include: [
      "./src/@(test?(s)|__test?(s)__)/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
      "./src/scripts/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
      //"./src/test/services/message-events/summary-event-logger.test.ts"
    ],

    exclude: ["./src/**/@(fixture*(s)|dist|node_modules)/**"],
    maxConcurrency: 1,
    testTimeout: 120000, // Timeout in milliseconds,
    globalSetup: "./src/test/setup-tests.ts",
  },
});
