import { setRequestLocale } from "next-intl/server"
import { Suspense, use } from "react"
import { MessagesPageClient } from "@/components/messages/messages-client"

export { generateStaticParams } from "@/util/route-helpers"

function Loading() {
  return (
    <output aria-label='Loading'>
      <div>Loading...</div>
    </output>
  )
}

export default function Page({ params }: PageProps<"/[locale]/messages">) {
  const { locale } = use(params)
  setRequestLocale(locale)

  return (
    <Suspense fallback={<Loading />}>
      <MessagesPageClient />
    </Suspense>
  )
}
