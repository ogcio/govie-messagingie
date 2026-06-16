import {
  defineZoneEnv,
  requiredInProduction,
  z,
} from "@citizen-portal/shared/env"

/**
 * App-local client env schema for the unified citizen-portal.
 *
 * Phase B1 brought in the messages-zone vars; Phase B2 adds the
 * profile-zone-specific ones used by the global-signout iframe fan-out
 * and the PS bounce table in `ZONE_CONFIG`:
 *   - `*_ADMIN_URL` per zone (messaging / profile / dashboard) — each
 *     ClientShell zone bounces public servants to the matching admin
 *     app via `useOnboardingGuard`.
 *   - `PAYMENTS_URL` / `JOURNEY_URL` — non-zone apps that the profile
 *     global-signout fan-out also targets.
 *   - `MYGOVID_END_SESSION_URL` — IdP end-session iframe (citizen role
 *     only).
 *
 * Cross-zone host URLs (`NEXT_PUBLIC_MESSAGING_URL`,
 * `NEXT_PUBLIC_PROFILE_URL`, `NEXT_PUBLIC_DASHBOARD_URL`) and SAG config
 * still live in `@citizen-portal/shared` and stay accessible via
 * `useEnv()` / `getEnv()` / `useCrossZoneLink()`. They're declared there
 * (not here) because they cross zone boundaries — see the Phase II plan.
 */

const requiredUrl = z.url()
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.url().optional(),
)

export const env = defineZoneEnv({
  client: {
    NEXT_PUBLIC_BASE_URL: requiredUrl.default(
      "http://messaging.local.test:8080",
    ),
    /**
     * Admin app URLs — each ClientShell zone bounces public servants to
     * the matching admin app via `useOnboardingGuard`. Admin apps are
     * NOT citizen-portal zones; they stay as zone-local env vars.
     */
    NEXT_PUBLIC_MESSAGING_ADMIN_URL: requiredUrl.default(
      "http://localhost:3022",
    ),
    NEXT_PUBLIC_PROFILE_ADMIN_URL: requiredUrl.default("http://localhost:3033"),
    NEXT_PUBLIC_DASHBOARD_ADMIN_URL: requiredUrl.default(
      "http://localhost:3012",
    ),

    /**
     * Non-citizen-portal apps targeted by the profile global-signout
     * iframe fan-out. Promote to `@citizen-portal/shared` if/when they
     * become citizen-portal zones.
     */
    NEXT_PUBLIC_PAYMENTS_URL: requiredUrl.default("http://localhost:3013"),
    NEXT_PUBLIC_JOURNEY_URL: requiredUrl.default("http://localhost:3014"),

    /** Optional IdP end-session URL (citizen role only, global signout). */
    NEXT_PUBLIC_MYGOVID_END_SESSION_URL: optionalUrl,

    /** Forms service base URL — used for error reporting redirects */
    NEXT_PUBLIC_FORMS_SERVICE_URL: requiredUrl.default("http://localhost:3004"),
    /** Error form ID appended to the forms service URL */
    NEXT_PUBLIC_ERROR_FORM_ID: z.string().default(""),

    NEXT_PUBLIC_UNLEASH_URL: optionalUrl,
    NEXT_PUBLIC_UNLEASH_CLIENT_KEY: z.string().optional(),
    NEXT_PUBLIC_UNLEASH_APP_NAME: z.string().default("messaging"),

    /**
     * Dev-only fallback: when the messages API returns an empty list,
     * render a bundled fixture (`src/mock/messages.json`) so the unified
     * inbox has content to show. Defaults to `false`. Set to `true` in
     * local `.env` for UI development without a working backend. Build
     * pipelines may pass "false", "False", or YAML booleans stringified —
     * normalize before strict enum.
     */
    NEXT_PUBLIC_ENABLE_MOCK_MESSAGES: z
      .preprocess(
        (v) => {
          if (v === undefined || v === null || v === "") return "false"
          const s = String(v).trim().toLowerCase()
          if (["true", "1", "yes", "on"].includes(s)) return "true"
          if (["false", "0", "no", "off"].includes(s)) return "false"
          return "false"
        },
        z.enum(["true", "false"]),
      )
      .transform((v) => v === "true"),

    /** Matomo — same IDs as legacy messaging (`ANALYTICS_*`). Optional URL: set directly or via MATOMO_* below. */
    NEXT_PUBLIC_ANALYTICS_URL: optionalUrl,
    NEXT_PUBLIC_MATOMO_URL: z.string().optional(),
    NEXT_PUBLIC_MATOMO_PROTOCOL: z.enum(["http", "https"]).optional(),
    NEXT_PUBLIC_ANALYTICS_WEBSITE_ID: z.string().optional(),
    NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID: z.string().default("ogcio"),
    /** Build pipelines may pass "false", "False", or YAML booleans stringified — normalize before strict enum. */
    NEXT_PUBLIC_ANALYTICS_DRY_RUN: z
      .preprocess(
        (v) => {
          if (v === undefined || v === null || v === "") return "true"
          const s = String(v).trim().toLowerCase()
          if (["true", "1", "yes", "on"].includes(s)) return "true"
          if (["false", "0", "no", "off"].includes(s)) return "false"
          return "true"
        },
        z.enum(["true", "false"]),
      )
      .transform((v) => v === "true"),

    /** Faro observability configuration */
    NEXT_PUBLIC_FARO_URL: optionalUrl.superRefine(requiredInProduction),
    NEXT_PUBLIC_FARO_SERVICE_NAME: z
      .string()
      .optional()
      .superRefine(requiredInProduction)
      .default("citizen-portal"),
    NEXT_PUBLIC_FARO_SERVICE_NAMESPACE: z
      .string()
      .optional()
      .superRefine(requiredInProduction)
      .default("messaging"),
    NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER: z
      .string()
      .optional()
      .superRefine(requiredInProduction),
    NEXT_PUBLIC_VERSION: z.string().default(process.env.version ?? "0.0.0"),
  },
  runtimeEnv: {
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_MESSAGING_ADMIN_URL:
      process.env.NEXT_PUBLIC_MESSAGING_ADMIN_URL,
    NEXT_PUBLIC_PROFILE_ADMIN_URL: process.env.NEXT_PUBLIC_PROFILE_ADMIN_URL,
    NEXT_PUBLIC_DASHBOARD_ADMIN_URL:
      process.env.NEXT_PUBLIC_DASHBOARD_ADMIN_URL,
    NEXT_PUBLIC_PAYMENTS_URL: process.env.NEXT_PUBLIC_PAYMENTS_URL,
    NEXT_PUBLIC_JOURNEY_URL: process.env.NEXT_PUBLIC_JOURNEY_URL,
    NEXT_PUBLIC_MYGOVID_END_SESSION_URL:
      process.env.NEXT_PUBLIC_MYGOVID_END_SESSION_URL,
    NEXT_PUBLIC_FORMS_SERVICE_URL: process.env.NEXT_PUBLIC_FORMS_SERVICE_URL,
    NEXT_PUBLIC_ERROR_FORM_ID: process.env.NEXT_PUBLIC_ERROR_FORM_ID,
    NEXT_PUBLIC_UNLEASH_URL: process.env.NEXT_PUBLIC_UNLEASH_URL,
    NEXT_PUBLIC_UNLEASH_CLIENT_KEY: process.env.NEXT_PUBLIC_UNLEASH_CLIENT_KEY,
    NEXT_PUBLIC_UNLEASH_APP_NAME: process.env.NEXT_PUBLIC_UNLEASH_APP_NAME,
    NEXT_PUBLIC_ENABLE_MOCK_MESSAGES:
      process.env.NEXT_PUBLIC_ENABLE_MOCK_MESSAGES,
    NEXT_PUBLIC_ANALYTICS_URL: process.env.NEXT_PUBLIC_ANALYTICS_URL,
    NEXT_PUBLIC_MATOMO_URL: process.env.NEXT_PUBLIC_MATOMO_URL,
    NEXT_PUBLIC_MATOMO_PROTOCOL: process.env.NEXT_PUBLIC_MATOMO_PROTOCOL,
    NEXT_PUBLIC_ANALYTICS_WEBSITE_ID:
      process.env.NEXT_PUBLIC_ANALYTICS_WEBSITE_ID,
    NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID:
      process.env.NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID,
    NEXT_PUBLIC_ANALYTICS_DRY_RUN: process.env.NEXT_PUBLIC_ANALYTICS_DRY_RUN,
    NEXT_PUBLIC_FARO_URL: process.env.NEXT_PUBLIC_FARO_URL,
    NEXT_PUBLIC_FARO_SERVICE_NAME: process.env.NEXT_PUBLIC_FARO_SERVICE_NAME,
    NEXT_PUBLIC_FARO_SERVICE_NAMESPACE:
      process.env.NEXT_PUBLIC_FARO_SERVICE_NAMESPACE,
    NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER:
      process.env.NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER,
    NEXT_PUBLIC_VERSION: process.env.version,
  },
})
