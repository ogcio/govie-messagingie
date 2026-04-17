import { check, sleep } from "k6"
import http from "k6/http"
import { Counter, Rate, Trend } from "k6/metrics"

// Base URL configuration - auto-detect localhost:3000 or use environment variable
export const BASE_URL = __ENV.BASE_URL || "http://localhost:3002"

// Route definitions
export const ROUTES = {
  messages: "/en/messages",
} as const

export type RouteName = keyof typeof ROUTES

// Custom metrics per route
export const routeMetrics: Record<
  RouteName,
  { duration: Trend; errors: Rate; requests: Counter }
> = {
  messages: {
    duration: new Trend("messages_duration", true),
    errors: new Rate("messages_errors"),
    requests: new Counter("messages_requests"),
  },
}

// Response validation
export interface RouteResponse {
  success: boolean
  duration: number
  status: number
  route: RouteName
}

/**
 * Fetch a route and record metrics
 */
export function fetchRoute(routeName: RouteName): RouteResponse {
  const url = `${BASE_URL}${ROUTES[routeName]}`
  const metrics = routeMetrics[routeName]

  const response = http.get(url, {
    tags: { route: routeName },
    timeout: "30s",
  })

  const isSuccess = response.status === 200

  // Record metrics
  metrics.duration.add(response.timings.duration)
  metrics.errors.add(!isSuccess)
  metrics.requests.add(1)

  // Validate response
  check(response, {
    [`${routeName}: status is 200`]: (r) => r.status === 200,
    [`${routeName}: response time < 10s`]: (r) => r.timings.duration < 10000,
  })

  return {
    success: isSuccess,
    duration: response.timings.duration,
    status: response.status,
    route: routeName,
  }
}

/**
 * Fetch all routes sequentially and return results
 */
export function fetchAllRoutes(): RouteResponse[] {
  const results: RouteResponse[] = []

  for (const routeName of Object.keys(ROUTES) as RouteName[]) {
    results.push(fetchRoute(routeName))
    sleep(0.1) // Small pause between requests
  }

  return results
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`
  }
  return `${(ms / 1000).toFixed(2)}s`
}

/**
 * Get route display name for output
 */
export function getRouteDisplayName(routeName: RouteName): string {
  const displayNames: Record<RouteName, string> = {
    messages: "Messages (/en/messages)",
  }
  return displayNames[routeName]
}

/**
 * Common thresholds for all tests
 * These are intentionally lenient to allow tests to pass while measuring performance.
 * Adjust based on your baseline measurements.
 */
export const commonThresholds = {
  http_req_duration: ["p(95)<30000"], // 95% of requests under 30s
  http_req_failed: ["rate<0.10"], // Error rate below 10%

  messages_duration: ["p(95)<30000"],
  messages_errors: ["rate<0.10"],
}
