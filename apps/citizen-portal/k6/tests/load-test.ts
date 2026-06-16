/**
 * Progressive Load Test
 *
 * Tests all three messaging routes with progressively increasing load
 * from 10 VUs up to 200 VUs to identify performance degradation points.
 *
 * Run with: k6 run k6/tests/load-test.ts
 * Or: pnpm test:k6:load
 */

import { sleep } from "k6"
import exec from "k6/execution"
import type { Options } from "k6/options"
import {
  BASE_URL,
  commonThresholds,
  fetchRoute,
  formatDuration,
  ROUTES,
  type RouteName,
  // Need to maintain .ts extension for k6 to recognize the module
} from "../utils/helpers.ts"

// Test configuration with ramping stages
export const options: Options = {
  stages: [
    // Warm-up
    { duration: "30s", target: 10 },

    // Stage 1: Low load (10 VUs)
    { duration: "2m", target: 10 },

    // Ramp up to 50 VUs
    { duration: "30s", target: 50 },

    // Stage 2: Medium load (50 VUs)
    { duration: "2m", target: 50 },

    // Ramp up to 100 VUs
    { duration: "30s", target: 100 },

    // Stage 3: High load (100 VUs)
    { duration: "2m", target: 100 },

    // Ramp up to 200 VUs
    { duration: "30s", target: 200 },

    // Stage 4: Peak load (200 VUs)
    { duration: "2m", target: 200 },

    // Cool down
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    ...commonThresholds,
    // Adjusted thresholds for high load - more lenient
    http_req_duration: ["p(95)<45000"], // Allow higher latency under peak load
    http_req_failed: ["rate<0.15"], // Allow up to 15% errors under peak load
  },
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

// Track stage transitions for logging
let lastLoggedStage = ""

function getLoadStage(vus: number): string {
  if (vus <= 10) return "Low Load (≤10 VUs)"
  if (vus <= 50) return "Medium Load (11-50 VUs)"
  if (vus <= 100) return "High Load (51-100 VUs)"
  return "Peak Load (101-200 VUs)"
}

// Setup function
export function setup(): void {
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║      K6 Progressive Load Test - messaging-next            ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log(`║  Base URL: ${BASE_URL.padEnd(47)}║`)
  console.log("║                                                           ║")
  console.log("║  Routes being tested:                                     ║")

  for (const [name, path] of Object.entries(ROUTES)) {
    console.log(`║    - ${(name + ":").padEnd(15)} ${path.padEnd(35)}║`)
  }

  console.log("║                                                           ║")
  console.log("║  Load Stages:                                             ║")
  console.log("║    1. Warm-up:    0 → 10 VUs    (30s)                      ║")
  console.log("║    2. Low:        10 VUs        (2m)                       ║")
  console.log("║    3. Ramp:       10 → 50 VUs   (30s)                      ║")
  console.log("║    4. Medium:     50 VUs        (2m)                       ║")
  console.log("║    5. Ramp:       50 → 100 VUs  (30s)                      ║")
  console.log("║    6. High:       100 VUs       (2m)                       ║")
  console.log("║    7. Ramp:       100 → 200 VUs (30s)                      ║")
  console.log("║    8. Peak:       200 VUs       (2m)                       ║")
  console.log("║    9. Cool-down:  200 → 0 VUs   (30s)                      ║")
  console.log("║                                                           ║")
  console.log("║  Total Duration: ~11 minutes                              ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
  console.log("")
}

// Main test function
export default function (): void {
  const routes: RouteName[] = ["messages"]
  const currentVUs = exec.instance.vusActive
  const currentStage = getLoadStage(currentVUs)

  // Log stage transitions
  if (currentStage !== lastLoggedStage && exec.vu.iterationInInstance === 0) {
    console.log(`\n▶ Stage: ${currentStage} (${currentVUs} active VUs)`)
    lastLoggedStage = currentStage
  }

  // Test each route with identical request pattern
  for (const route of routes) {
    const result = fetchRoute(route)

    // Log slow responses (>5s) for debugging
    if (result.duration > 5000) {
      console.log(
        `⚠ Slow response: ${route} took ${formatDuration(result.duration)} ` +
          `(VU: ${exec.vu.idInTest}, Stage: ${currentStage})`,
      )
    }
  }

  // Small pause before next iteration
  sleep(1)
}

// Teardown function with summary
export function teardown(): void {
  console.log("")
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║              Load Test Complete - Summary                 ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log("║                                                           ║")
  console.log("║  Check the metrics above for detailed results:            ║")
  console.log("║                                                           ║")
  console.log("║  📊 Key Metrics:                                          ║")
  console.log("║                                                           ║")
  console.log("║    Route              │ Metric Name                       ║")
  console.log("║    ───────────────────┼─────────────────────────────────  ║")
  console.log("║    Messages (/en/messages) │ messages_duration            ║")
  console.log("║                                                           ║")
  console.log("║  🎯 What to Look For:                                     ║")
  console.log("║                                                           ║")
  console.log("║    1. Compare p95 latencies across load stages            ║")
  console.log("║    2. Check error rates (messages_errors) under peak load ║")
  console.log("║    3. Note the throughput (messages_requests count)       ║")
  console.log("║    4. Identify the load level where performance degrades  ║")
  console.log("║                                                           ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
}
