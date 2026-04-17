import { redirect } from "next/navigation"
import { use } from "react"

export { generateStaticParams } from "@/util/route-helpers"

export default function LocaleIndexPage({ params }: PageProps<"/[locale]">) {
  const { locale } = use(params)
  redirect(`/${locale}/messages`)
}
