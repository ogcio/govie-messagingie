/**
 * Route Comparison Test
 *
 * Dedicated comparison test that runs each route independently
 * and outputs a clear performance ranking at each load level.
 *
 * Run with: k6 run k6/tests/comparison.ts
 * Or: pnpm test:k6:compare
 */

import { check, sleep } from "k6"
import http from "k6/http"
import { Trend } from "k6/metrics"
import type { Options } from "k6/options"
// Need to maintain .ts extension for k6 to recognize the module
import { BASE_URL, ROUTES, type RouteName } from "../utils/helpers.ts"

// Dedicated trends for comparison (cleaner output)
const messagesTrend = new Trend("route_messages", true)

const trendMap: Record<RouteName, Trend> = {
  messages: messagesTrend,
}

// Test configuration - separate scenarios per load level for clear comparison
export const options: Options = {
  scenarios: {
    // 10 VUs comparison
    compare_10_vus: {
      executor: "constant-vus",
      vus: 10,
      duration: "1m",
      startTime: "0s",
      tags: { load_level: "10_vus" },
    },
    // 50 VUs comparison
    compare_50_vus: {
      executor: "constant-vus",
      vus: 50,
      duration: "1m",
      startTime: "1m10s",
      tags: { load_level: "50_vus" },
    },
    // 100 VUs comparison (peak load)
    compare_100_vus: {
      executor: "constant-vus",
      vus: 100,
      duration: "1m",
      startTime: "2m20s",
      tags: { load_level: "100_vus" },
    },
  },
  thresholds: {
    // Per-route thresholds - very lenient to allow measurement under load
    route_messages: ["p(95)<60000"],

    // Overall - lenient for high load scenarios
    http_req_failed: ["rate<0.25"],
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

// Setup function
export function setup(): void {
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║       K6 Route Comparison Test - messaging-next           ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log(`║  Base URL: ${BASE_URL.padEnd(47)}║`)
  console.log("║                                                           ║")
  console.log("║  This test compares all routes at different load levels   ║")
  console.log("║  to determine which performs best under various conditions║")
  console.log("║                                                           ║")
  console.log("║  Load Levels:                                             ║")
  console.log("║    • 10 VUs  - Light load    (1 min)                      ║")
  console.log("║    • 50 VUs  - Medium load   (1 min)                      ║")
  console.log("║    • 100 VUs - Peak load     (1 min)                      ║")
  console.log("║                                                           ║")
  console.log("║  Total Duration: ~4 minutes                               ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
  console.log("")
}

// Main test function
export default function (): void {
  const routes: RouteName[] = ["messages"]

  for (const routeName of routes) {
    const url = `${BASE_URL}${ROUTES[routeName]}`

    const response = http.get(url, {
      tags: { route: routeName },
      timeout: "30s",
    })

    // Record to dedicated trend
    trendMap[routeName].add(response.timings.duration)

    // Basic validation
    check(response, {
      "status is 200": (r) => r.status === 200,
    })

    sleep(0.2)
  }

  sleep(0.5)
}

// Teardown with comparison analysis
export function teardown(): void {
  console.log("")
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║            Route Comparison Complete                      ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log("║                                                           ║")
  console.log("║  📊 PERFORMANCE GUIDE                                     ║")
  console.log("║  ─────────────────────────────────────────────────────────║")
  console.log("║                                                           ║")
  console.log("║  Look at the 'route_*' metrics in the summary above:      ║")
  console.log("║                                                           ║")
  console.log("║    route_messages → /en/messages                          ║")
  console.log("║                                                           ║")
  console.log("║  Compare the 'avg' and 'p95' columns across load levels:  ║")
  console.log("║                                                           ║")
  console.log("║    • Lowest avg = Fastest average response                ║")
  console.log("║    • Lowest p95 = Most consistent under load              ║")
  console.log("║    • Lowest max = Best worst-case scenario                ║")
  console.log("║                                                           ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
}
