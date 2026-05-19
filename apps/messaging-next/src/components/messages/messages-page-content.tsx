import { setRequestLocale } from "next-intl/server"
import { MessagesPageClient } from "@/components/messages/messages-client"

export function MessagesPageContent({ locale }: { locale: string }) {
  setRequestLocale(locale)
  return <MessagesPageClient />
}
