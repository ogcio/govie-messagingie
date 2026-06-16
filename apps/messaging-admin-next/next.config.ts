import type { NextConfig } from "next"
import { PHASE_DEVELOPMENT_SERVER } from "next/constants"
import createNextIntlPlugin from "next-intl/plugin"
import "@/env/env.server"
import "@/env/env.client"
import type { LoggingConfig } from "next/dist/server/config-shared"

const { version } = require("./package.json")

const withNextIntl = createNextIntlPlugin()

/**
 * Conditionally applies the bundle analyzer when ANALYZE=true.
 *
 * Uses require() instead of a static import because the monorepo has both
 * next@14 and next@16 installed, and @next/bundle-analyzer's static types
 * resolve against the wrong next installation, creating an incompatible
 * NextConfig type at the TypeScript level. At runtime, the analyzer simply
 * injects a webpack plugin and passes the config through unchanged.
 */
function withBundleAnalyzerIfEnabled(config: NextConfig): NextConfig {
  if (process.env.ANALYZE !== "true") return config
  const createAnalyzer: (opts: {
    enabled: boolean
  }) => (config: NextConfig) => NextConfig = require("@next/bundle-analyzer")
  return createAnalyzer({ enabled: true })(config)
}

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    version: version || "0.0.0",
  },
  poweredByHeader: false,
  reactStrictMode: false,
  cacheComponents: false,
  // Transpile packages that export raw TypeScript (e.g. file: linked packages)
  transpilePackages: [
    "@ogcio/sag-client",
    "@ogcio/nextjs-analytics",
    "@ogcio/analytics-sdk",
  ],
  // Optimize package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      "@ogcio/design-system-react",
      "next-intl",
      "@t3-oss/env-nextjs",
      "@t3-oss/env-core",
    ],
  },
  // Enhanced debug logging for development
  logging: {
    // Log full URLs for all fetch requests (useful for debugging API calls)
    fetches: {
      fullUrl: true,
      // Log Server Components HMR cache refreshes
      hmrRefreshes: true,
    },
    // Incoming request logging (can ignore specific patterns or disable)
    incomingRequests: true,
  } satisfies LoggingConfig,
}

function withAnalyticsApiDevProxy(
  config: NextConfig,
  phase: string,
): NextConfig {
  if (phase !== PHASE_DEVELOPMENT_SERVER) {
    return config
  }
  return {
    ...config,
    async rewrites() {
      return [
        {
          source: "/_next/analytics-api/:path*",
          destination: `${process.env.ANALYTICS_MANAGEMENT_API_ORIGIN ?? "https://api.analytics.dev.services.gov.ie"}/:path*`,
        },
      ]
    },
  }
}

export default function messagingNextConfig(phase: string): NextConfig {
  return withBundleAnalyzerIfEnabled(
    withNextIntl(withAnalyticsApiDevProxy(nextConfig, phase)),
  )
}
