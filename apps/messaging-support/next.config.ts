import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pino",
    "thread-stream",
    "tap",
    // OpenTelemetry packages needed for instrumentation
    "@opentelemetry/instrumentation-pino",
    "@opentelemetry/instrumentation",
    "import-in-the-middle",
    "require-in-the-middle",
  ],
  output: "standalone",
  transpilePackages: ["@ogcio/nextjs-analytics", "@ogcio/analytics-sdk"],
}

export default nextConfig
