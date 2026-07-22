"use client"

import type { ReactNode } from "react"
import { SWRConfig } from "swr"
import { focusRevalidationByEndpoint } from "@/lib/swr-focus-revalidation"

/**
 * App-wide SWR defaults. Focus revalidation is off by default and re-enabled
 * per endpoint by {@link focusRevalidationByEndpoint}, so only messages and
 * applications refetch when the tab regains focus.
 */
export function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        use: [focusRevalidationByEndpoint],
      }}
    >
      {children}
    </SWRConfig>
  )
}
