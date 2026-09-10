import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: "default",
    setupFiles: ["./src/test/setup-env.ts"],
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
      // Measured locally: 83.96 lines / 83.91 statements / 87.14 functions / 78.01 branches.
      thresholds: {
        lines: 82,
        statements: 82,
        functions: 85,
        branches: 76,
      },
      exclude: [
        ...defaultExclude,
        "src/test/**/*",
        ".**/**/*.js",
        ".**/**/*.ts",
        "db/**/*",
      ],
    },
    include: [
      "./src/@(test?(s)|__test?(s)__)/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
    ],
    exclude: [
      "./src/**/@(fixture*(s)|dist|node_modules)/**",
      "./src/**/*.integration.test.*",
    ],
    testTimeout: 60000,
  },
});
