import { Suspense } from "react"
import { MessageEventsPageClient } from "@/components/message-events/message-events-page-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function MessageEventsPage() {
  return (
    <Suspense fallback={null}>
      <MessageEventsPageClient />
    </Suspense>
  )
}
