import { Suspense } from "react"
import { EmailProviderFormClient } from "@/components/providers/email-provider-form-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function EmailProviderPage() {
  return (
    <Suspense fallback={null}>
      <EmailProviderFormClient />
    </Suspense>
  )
}
