import { Suspense } from "react"
import { ProvidersPageClient } from "@/components/providers/providers-page-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function ProvidersPage() {
  return (
    <Suspense fallback={null}>
      <ProvidersPageClient />
    </Suspense>
  )
}
