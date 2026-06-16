"use client"

import type { Faro } from "@ogcio/o11y-sdk-react"
import { useEffect, useRef } from "react"
import { env } from "@/env/env.client"

export default function FrontendObservability() {
  const faroRef = useRef<Faro | undefined>(undefined)

  useEffect(() => {
    const collectorUrl = env.NEXT_PUBLIC_FARO_URL
    if (collectorUrl && !faroRef.current) {
      import("@ogcio/o11y-sdk-react").then(({ instrumentFaro }) => {
        if (!faroRef.current) {
          faroRef.current = instrumentFaro({
            serviceName: env.NEXT_PUBLIC_FARO_SERVICE_NAME,
            collectorUrl,
            corsTraceHeaders: env.NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER,
            collectorMode: "batch",
            appMeta: {
              name: env.NEXT_PUBLIC_FARO_SERVICE_NAME,
              namespace: env.NEXT_PUBLIC_FARO_SERVICE_NAMESPACE,
              version: env.NEXT_PUBLIC_VERSION,
            },
          })
        }
      })
    }
  }, [])

  return null
}
