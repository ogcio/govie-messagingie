import { defaultExclude, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: "default",
    setupFiles: ["./src/test/setup-env.ts"],
    coverage: {
      reporter: ["text", "cobertura", "lcov"],
      provider: "v8",
      reportOnFailure: true,
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
