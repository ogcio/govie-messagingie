/// <reference types="vitest" />

import { fileURLToPath } from "node:url"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    reporters: "default",
    setupFiles: "./vitest.setup.ts",
    coverage: {
      reporter: ["text", "cobertura", "lcov"],
      provider: "v8",
      reportOnFailure: true,
    },
    deps: {
      optimizer: {
        web: {
          include: ["@ogcio/design-system-react"],
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
  // Optimize dependencies to handle Next.js modules
  optimizeDeps: {
    exclude: ["next"],
  },
})
