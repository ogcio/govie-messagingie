/**
 * Single Route Load Test
 *
 * Tests a single route in isolation with progressive load.
 * Pass the route name via the ROUTE environment variable.
 *
 * Usage:
 *   k6 run -e ROUTE=messages k6/tests/single-route.ts
 *
 * Or use npm scripts:
 *   pnpm test:k6:route:messages
 */

import { check, sleep } from "k6"
import http from "k6/http"
import { Counter, Rate, Trend } from "k6/metrics"
import type { Options } from "k6/options"
import {
  BASE_URL,
  formatDuration,
  ROUTES,
  type RouteName,
} from "../utils/helpers.ts"

// Get route from environment variable
const ROUTE = (__ENV.ROUTE as RouteName) || "messages"

// Validate route
const validRoutes: RouteName[] = ["messages"]
if (!validRoutes.includes(ROUTE)) {
  throw new Error(
    `Invalid route: ${ROUTE}. Valid routes are: ${validRoutes.join(", ")}`,
  )
}

// Custom metrics for this route
const routeDuration = new Trend(`${ROUTE}_duration`, true)
const routeErrors = new Rate(`${ROUTE}_errors`)
const routeRequests = new Counter(`${ROUTE}_requests`)

// Route display names
const routeDisplayNames: Record<RouteName, string> = {
  messages: "Messages (/en/messages)",
}

// Test configuration - progressive load up to 100 VUs
export const options: Options = {
  scenarios: {
    // Light load
    light_load: {
      executor: "constant-vus",
      vus: 10,
      duration: "1m",
      startTime: "0s",
      tags: { stage: "light" },
    },
    // Medium load
    medium_load: {
      executor: "constant-vus",
      vus: 50,
      duration: "1m",
      startTime: "1m10s",
      tags: { stage: "medium" },
    },
    // Peak load
    peak_load: {
      executor: "constant-vus",
      vus: 100,
      duration: "1m",
      startTime: "2m20s",
      tags: { stage: "peak" },
    },
  },
  thresholds: {
    [`${ROUTE}_duration`]: ["p(95)<60000"],
    [`${ROUTE}_errors`]: ["rate<0.25"],
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
  const routePath = ROUTES[ROUTE]
  const displayName = routeDisplayNames[ROUTE]

  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║         K6 Single Route Load Test                         ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log(`║  Base URL: ${BASE_URL.padEnd(47)}║`)
  console.log("║                                                           ║")
  console.log(`║  Route: ${ROUTE.padEnd(50)}║`)
  console.log(`║  Path:  ${routePath.padEnd(50)}║`)
  console.log(`║  Type:  ${displayName.padEnd(50)}║`)
  console.log("║                                                           ║")
  console.log("║  Load Stages:                                             ║")
  console.log("║    1. Light:  10 VUs  (1 min)                             ║")
  console.log("║    2. Medium: 50 VUs  (1 min)                             ║")
  console.log("║    3. Peak:   100 VUs (1 min)                             ║")
  console.log("║                                                           ║")
  console.log("║  Total Duration: ~4 minutes                               ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
  console.log("")
}

// Main test function
export default function (): void {
  const url = `${BASE_URL}${ROUTES[ROUTE]}`

  const response = http.get(url, {
    tags: { route: ROUTE },
    timeout: "60s",
  })

  const isSuccess = response.status === 200

  // Record metrics
  routeDuration.add(response.timings.duration)
  routeErrors.add(!isSuccess)
  routeRequests.add(1)

  // Validate response
  check(response, {
    "status is 200": (r) => r.status === 200,
    "response time < 30s": (r) => r.timings.duration < 30000,
  })

  // Log slow responses
  if (response.timings.duration > 5000) {
    console.log(`⚠ Slow response: ${formatDuration(response.timings.duration)}`)
  }

  // Small pause between requests
  sleep(0.5)
}

// Teardown function
export function teardown(): void {
  const displayName = routeDisplayNames[ROUTE]

  console.log("")
  console.log("╔═══════════════════════════════════════════════════════════╗")
  console.log("║              Single Route Test Complete                   ║")
  console.log("╠═══════════════════════════════════════════════════════════╣")
  console.log("║                                                           ║")
  console.log(`║  Route Tested: ${ROUTE.padEnd(43)}║`)
  console.log(`║  Type: ${displayName.padEnd(51)}║`)
  console.log("║                                                           ║")
  console.log("║  📊 Key Metrics to Review:                                ║")
  console.log("║                                                           ║")
  console.log(`${`║    ${ROUTE}_duration  - Response times`.padEnd(60)}║`)
  console.log(`${`║    ${ROUTE}_errors    - Error rate`.padEnd(60)}║`)
  console.log(`${`║    ${ROUTE}_requests  - Total requests`.padEnd(60)}║`)
  console.log("║                                                           ║")
  console.log("║  Run again with:                                          ║")
  console.log("║    k6 run -e ROUTE=messages k6/tests/single-route.ts      ║")
  console.log("║                                                           ║")
  console.log("╚═══════════════════════════════════════════════════════════╝")
}
