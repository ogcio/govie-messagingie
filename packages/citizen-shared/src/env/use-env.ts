"use client"

import type { ZoneHosts } from "../cross-zone"
import { env } from "./client"

export interface CitizenEnv {
  hosts: ZoneHosts
  sagUrl: string
  sagAppName: string
}

/**
 * Reshape the flat `NEXT_PUBLIC_*` env vars into the typed shape the
 * cross-zone helpers expect.
 *
 * Pure: no fetching, no state, no effects. Safe to call inside render
 * (and in non-React code paths via `getEnv()`).
 */
export function useEnv(): CitizenEnv {
  return getEnv()
}

/**
 * Non-hook accessor — same shape as `useEnv` but callable from outside the
 * React tree (e.g. server components, route handlers, scripts).
 */
export function getEnv(): CitizenEnv {
  return {
    hosts: {
      messages: env.NEXT_PUBLIC_MESSAGING_URL,
      profile: env.NEXT_PUBLIC_PROFILE_URL,
      dashboard: env.NEXT_PUBLIC_DASHBOARD_URL,
    },
    sagUrl: env.NEXT_PUBLIC_SAG_URL,
    sagAppName: env.NEXT_PUBLIC_SAG_APP_NAME,
  }
}
