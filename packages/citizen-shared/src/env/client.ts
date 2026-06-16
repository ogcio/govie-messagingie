import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

const requiredUrl = z.url()

/**
 * Client-side env schema for the cross-zone helpers.
 *
 * Mirrors the `@t3-oss/env-nextjs` pattern from `messaging-next` so the
 * citizen-portal zones can opt-in by composing this schema with their own
 * zone-local vars (or by re-exporting `env` directly when no zone-specific
 * vars are needed).
 *
 * Defaults target the local docker-compose hostnames (`*.local.test:8080`)
 * so `pnpm dev` works without a populated `.env` file.
 */
export const env = createEnv({
  client: {
    NEXT_PUBLIC_SAG_URL: requiredUrl.default("http://localhost:3333"),
    NEXT_PUBLIC_SAG_APP_NAME: z.string().default("citizen-portal"),
    NEXT_PUBLIC_MESSAGING_URL: requiredUrl.default(
      "http://messaging.local.test:8080",
    ),
    NEXT_PUBLIC_PROFILE_URL: requiredUrl.default(
      "http://profile.local.test:8080",
    ),
    NEXT_PUBLIC_DASHBOARD_URL: requiredUrl.default(
      "http://dashboard.local.test:8080",
    ),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SAG_URL: process.env.NEXT_PUBLIC_SAG_URL,
    NEXT_PUBLIC_SAG_APP_NAME: process.env.NEXT_PUBLIC_SAG_APP_NAME,
    NEXT_PUBLIC_MESSAGING_URL: process.env.NEXT_PUBLIC_MESSAGING_URL,
    NEXT_PUBLIC_PROFILE_URL: process.env.NEXT_PUBLIC_PROFILE_URL,
    NEXT_PUBLIC_DASHBOARD_URL: process.env.NEXT_PUBLIC_DASHBOARD_URL,
  },
})

export type CitizenSharedEnv = typeof env
