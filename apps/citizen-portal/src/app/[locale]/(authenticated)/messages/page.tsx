import { use } from "react"
import { MessagesPageContent } from "@/components/messages/messages-page-content"

export { generateStaticParams } from "@/util/route-helpers"

export default function Page({ params }: PageProps<"/[locale]/messages">) {
  const { locale } = use(params)
  return <MessagesPageContent locale={locale} />
}
