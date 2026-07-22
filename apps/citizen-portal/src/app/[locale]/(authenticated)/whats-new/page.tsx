import { setRequestLocale } from "next-intl/server"
import { use } from "react"
import { WhatsNew } from "@/components/whats-new/whats-new"

export { generateStaticParams } from "@/util/route-helpers"

export default function Page({ params }: PageProps<"/[locale]/whats-new">) {
  const { locale } = use(params)
  setRequestLocale(locale)
  return <WhatsNew />
}
