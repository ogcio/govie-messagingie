import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    reporters: "default",
    coverage: {
      reporter: ["text", "cobertura", "lcov"],
      provider: "v8",
      reportOnFailure: true,
    },
    include: [
      "**/*.test.@(js|cjs|mjs|ts|tsx)",
      "**/*.spec.@(js|cjs|mjs|ts|tsx)",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
})
