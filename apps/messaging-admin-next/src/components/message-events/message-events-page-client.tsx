"use client"

import { Heading, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import EventTable from "@/components/message-events/EventTable"
import { SearchBar } from "@/components/message-events/SearchBar"
import { defaultFormGap } from "@/util/datetime"

export function MessageEventsPageClient() {
  const t = useTranslations("event")

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <Heading>{t("heading.mainEvents")}</Heading>
      <SearchBar />
      <EventTable />
    </Stack>
  )
}
