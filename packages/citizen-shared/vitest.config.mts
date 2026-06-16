import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    reporters: "default",
    include: [
      "**/*.test.@(js|cjs|mjs|ts|tsx)",
      "**/*.spec.@(js|cjs|mjs|ts|tsx)",
    ],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
})
