import { Suspense } from "react"
import { MessageTemplatesPageClient } from "@/components/message-templates/message-templates-page-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function MessageTemplatesPage() {
  return (
    <Suspense fallback={null}>
      <MessageTemplatesPageClient />
    </Suspense>
  )
}
