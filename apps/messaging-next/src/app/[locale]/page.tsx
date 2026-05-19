import { use } from "react"
import { MessagesPageContent } from "@/components/messages/messages-page-content"

export { generateStaticParams } from "@/util/route-helpers"

export default function LocaleIndexPage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params)
  return <MessagesPageContent locale={locale} />
}
