/**
 * @citizen-portal/shared
 *
 * Cross-zone helpers consumed by the messages, profile and dashboard zones
 * of the consolidated citizen-portal app.
 *
 * Story 1.3 surface:
 *   - cross-zone primitives (`Zone`, `ZoneHosts`, `getCrossZoneHref`,
 *     `getSharedParentDomain`)
 *   - `useCrossZoneLink()` hook for host-aware navigation between zones
 *   - `CitizenSagProvider` — env-aware wrapper around `SagClientProvider`
 *   - cross-zone client env schema (`@t3-oss/env-nextjs` + `zod`) and a
 *     `useEnv()` / `getEnv()` accessor pair
 */

export const CITIZEN_PORTAL_SHARED_VERSION = "0.1.0"

export * from "./cross-zone"
export * from "./env/client"
export * from "./env/define"
export * from "./env/use-env"
export * from "./sag-provider"
export * from "./use-cross-zone-link"
