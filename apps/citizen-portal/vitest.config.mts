import react from "@vitejs/plugin-react"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"

/**
 * Vitest configuration for the unified citizen-portal app.
 *
 * Includes the browser-test provider so the `*.browser.test.*` files
 * keep working when invoked with `--browser`; they remain excluded
 * from the default `pnpm test` run via the VITEST_BROWSER toggle.
 */
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
      "zones/**",
      ...(process.env.VITEST_BROWSER !== "true" ? ["**/*.browser.test.*"] : []),
    ],
    maxConcurrency: 1,
    testTimeout: 30000,
    server: {
      deps: {
        // The design system barrel uses `import { debounce } from "lodash"`,
        // a named import from a CJS module that Node's ESM loader can't resolve.
        // Inlining lets Vite transform it with proper CJS interop.
        inline: [/@ogcio[/\\]design-system-react/],
      },
    },
    browser: {
      enabled: false,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
  },
  resolve: {
    alias: {
      "@/": new URL("./src/", import.meta.url).pathname,
    },
  },
  optimizeDeps: {
    exclude: ["next", "next-intl"],
  },
})
