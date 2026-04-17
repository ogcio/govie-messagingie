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
        ".**/**/*.js",
        ".**/**/*.ts",
        "perf/**/*.js",
        "src/migrations/**/*.ts",
        "src/migrations/**/*.js",
      ],
    },
    include: [
      "./src/@(test?(s)|__test?(s)__)/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
      //"./src/test/services/message-events/summary-event-logger.test.ts"
    ],

    exclude: ["./src/**/@(fixture*(s)|dist|node_modules)/**"],
    maxConcurrency: 1,
    testTimeout: 120000, // Timeout in milliseconds,
    globalSetup: "./src/test/setup-tests.ts",
  },
});
