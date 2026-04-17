import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    reporters: "default",
    setupFiles: "./test/vitest.setup.ts",
    coverage: {
      reporter: ["text", "cobertura", "lcov"],
      provider: "v8",
      reportOnFailure: true,
    },
    include: [
      "**/@(test?(s)|__test?(s)__)/**/*.test.@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
      "**/*.@(test?(s)|spec).@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
      "**/test?(s).@(js|cjs|mjs|tap|cts|jsx|mts|ts|tsx)",
    ],
    exclude: [
      "**/@(fixture*(s)|dist|node_modules)/**",
      "e2e/**",
      // Browser tests are excluded from regular runs but included with --browser flag
      ...(process.env.VITEST_BROWSER !== "true" ? ["**/*.browser.test.*"] : []),
    ],
    maxConcurrency: 1,
    testTimeout: 30000, // Timeout in milliseconds (30 seconds),
    // Browser tests are enabled when using --browser flag
    browser: {
      enabled: false, // Set to true or use --browser flag
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  resolve: {
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
  },
  // Optimize dependencies to handle Next.js modules
  optimizeDeps: {
    exclude: ["next", "next-intl"],
  },
})
