import { Suspense } from "react"
import { MessageTemplateFormClient } from "@/components/message-templates/message-template-form-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function MessageTemplateEditPage() {
  return (
    <Suspense fallback={null}>
      <MessageTemplateFormClient />
    </Suspense>
  )
}
