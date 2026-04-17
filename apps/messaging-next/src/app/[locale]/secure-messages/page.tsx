import { setRequestLocale } from "next-intl/server"
import { Suspense, use } from "react"
import { SecureMessagePageClient } from "@/components/secure-messages/secure-message-page-client"

function Loading() {
  return (
    <output aria-label='Loading'>
      <div>Loading...</div>
    </output>
  )
}

export { generateStaticParams } from "@/util/route-helpers"

export default function Page({
  params,
}: PageProps<"/[locale]/secure-messages">) {
  const { locale } = use(params)
  setRequestLocale(locale)

  return (
    <Suspense fallback={<Loading />}>
      <SecureMessagePageClient />
    </Suspense>
  )
}
