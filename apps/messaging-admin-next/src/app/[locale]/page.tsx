import { redirect } from "next/navigation"

export { generateStaticParams } from "@/util/route-helpers"

export default async function LocaleIndexPage(props: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await props.params
  redirect(`/${locale}/send-a-message`)
}
