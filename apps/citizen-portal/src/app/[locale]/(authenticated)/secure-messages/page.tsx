import { setRequestLocale } from "next-intl/server"
import { Suspense, use } from "react"
import { MessagesLoading } from "@/components/messages/messages-loading"
import { SecureMessagePageClient } from "@/components/secure-messages/secure-message-page-client"

export { generateStaticParams } from "@/util/route-helpers"

export default function Page({
  params,
}: PageProps<"/[locale]/secure-messages">) {
  const { locale } = use(params)
  setRequestLocale(locale)

  return (
    <Suspense fallback={<MessagesLoading />}>
      <SecureMessagePageClient />
    </Suspense>
  )
}
