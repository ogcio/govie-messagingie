import { SendMessageProvider } from "@/components/send-message/SendMessageContext"
import { SendMessageWizard } from "@/components/send-message/SendMessageWizard"

export { generateStaticParams } from "@/util/route-helpers"

export default async function SendMessagePage() {
  return (
    <SendMessageProvider>
      <SendMessageWizard />
    </SendMessageProvider>
  )
}
