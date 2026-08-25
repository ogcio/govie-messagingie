import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    reporters: "default",
    include: ["./src/**/*.integration.test.@(ts|mts)"],
    exclude: [],
    testTimeout: 60000,
  },
});
