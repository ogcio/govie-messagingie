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
        "db/**/*",
      ],
    },
    include: [
      "./src/@(test?(s)|__test?(s)__)/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
    ],
    exclude: ["./src/**/@(fixture*(s)|dist|node_modules)/**"],
    testTimeout: 30000,
  },
});
