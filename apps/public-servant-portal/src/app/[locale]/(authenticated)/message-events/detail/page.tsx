import { Suspense } from "react"
import { MessageEventDetailClient } from "@/components/message-events/message-event-detail-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function MessageEventDetailPage() {
  return (
    <Suspense fallback={null}>
      <MessageEventDetailClient />
    </Suspense>
  )
}
