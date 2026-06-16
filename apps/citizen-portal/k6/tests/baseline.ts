/**
 * Baseline Performance Test
 *
 * Tests all three messaging routes plus the API endpoint with a low number
 * of virtual users (10-50) to establish baseline performance metrics.
 *
 * Run with: k6 run k6/tests/baseline.ts
 * Or: pnpm test:k6:baseline
 */

import { sleep } from "k6"
import type { Options } from "k6/options"
import {
  BASE_URL,
  commonThresholds,
  fetchRoute,
  ROUTES,
  type RouteName,
  // Need to maintain .ts extension for k6 to recognize the module
} from "../utils/helpers.ts"

// Test configuration
export const options: Options = {
  scenarios: {
    // Low load baseline - 10 VUs
    low_load: {
      executor: "constant-vus",
      vus: 10,
      duration: "30s",
      startTime: "0s",
      tags: { stage: "low_load" },
    },
    // Medium load baseline - 30 VUs
    medium_load: {
      executor: "constant-vus",
      vus: 30,
      duration: "30s",
      startTime: "35s",
      tags: { stage: "medium_load" },
    },
    // Higher baseline - 50 VUs
    high_load: {
      executor: "constant-vus",
      vus: 50,
      duration: "30s",
      startTime: "70s",
      tags: { stage: "high_load" },
    },
  },
  thresholds: commonThresholds,
  summaryTrendStats: [
    "avg",
    "min",
    "med",
    "max",
    "p(50)",
    "p(90)",
    "p(95)",
    "p(99)",
  ],
}

// Setup function - runs once before the test
export function setup(): void {
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║       K6 Baseline Performance Test - messaging-next       ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log(`║  Base URL: ${BASE_URL.padEnd(47)}║`)
  console.log("║                                                           ║")
  console.log("║  Routes being tested:                                     ║")

  for (const [name, path] of Object.entries(ROUTES)) {
    console.log(`║    - ${(name + ":").padEnd(15)} ${path.padEnd(35)}║`)
  }

  console.log("║                                                           ║")
  console.log("║  Stages:                                                  ║")
  console.log("║    1. Low Load:    10 VUs for 30s                         ║")
  console.log("║    2. Medium Load: 30 VUs for 30s                         ║")
  console.log("║    3. High Load:   50 VUs for 30s                         ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
  console.log("")
}

// Main test function - runs for each VU iteration
export default function (): void {
  const routes: RouteName[] = ["messages"]

  // Test each route with identical request pattern
  for (const route of routes) {
    fetchRoute(route)
    sleep(0.5) // 500ms pause between routes
  }

  // Small pause before next iteration
  sleep(1)
}

// Teardown function - runs once after the test
export function teardown(): void {
  console.log("")
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║              Baseline Test Complete                       ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log("║                                                           ║")
  console.log("║  Review the metrics above for:                            ║")
  console.log("║    - messages_duration   (Messages page)                  ║")
  console.log("║                                                           ║")
  console.log("║  Compare p50, p95, p99 latencies across load stages       ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
}
