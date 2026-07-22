"use client"

import type { AnnouncementLanguages } from "@ogcio/announcements/react"
import { useAnnouncementFeed } from "@ogcio/announcements/react"
import { Heading, Paragraph, Stack } from "@ogcio/design-system-react"
import { useLocale, useTranslations } from "next-intl"
import { useMemo } from "react"
import Markdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { CssSpinner } from "@/components/css-spinner"
import { TwoColumnLayout } from "@/components/layout/containers"

/**
 * Static "What's new" page.
 *
 * Reuses the exact data source that powers the announcements popup
 * (`useAnnouncementFeed` → Profile API via SAG), but requests the full
 * history (`newOnly: false`) instead of only the unacknowledged items
 * the modal shows. This keeps the changelog and the popup in sync — a
 * new announcement published in the support tool appears in both with
 * no code change here.
 *
 * Rendered inside the authenticated messages-zone shell, so the SAG
 * client provided by `ClientShell` is always available.
 */

const MESSAGING_ANNOUNCEMENTS_APPLICATION_ID = "messaging" as const

function formatPublishDate(iso: string, locale: AnnouncementLanguages): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return new Intl.DateTimeFormat(locale === "ga" ? "ga-IE" : "en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date)
}

export function WhatsNew() {
  const t = useTranslations("whatsNew")
  const locale = useLocale() as AnnouncementLanguages

  const {
    data: announcements,
    error,
    isLoading,
  } = useAnnouncementFeed(MESSAGING_ANNOUNCEMENTS_APPLICATION_ID, locale, {
    newOnly: false,
  })

  // Newest first — a changelog reads top-down from the latest release.
  const sorted = useMemo(
    () =>
      [...announcements].sort(
        (a, b) =>
          new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime(),
      ),
    [announcements],
  )

  return (
    <TwoColumnLayout>
      <Stack direction='column' gap={8} data-testid='whats-new-page'>
        <Heading as='h1' size='xl' data-testid='whats-new-heading'>
          {t("title")}
        </Heading>
        <Paragraph>{t("intro")}</Paragraph>

        {isLoading ? (
          <output
            aria-label={t("loading")}
            className='gi-flex gi-items-center gi-justify-center'
            style={{ minHeight: "20vh" }}
          >
            <CssSpinner size='lg' />
          </output>
        ) : error ? (
          <Paragraph data-testid='whats-new-error'>{t("error")}</Paragraph>
        ) : sorted.length === 0 ? (
          <Paragraph data-testid='whats-new-empty'>{t("empty")}</Paragraph>
        ) : (
          <Stack direction='column' gap={8} data-testid='whats-new-list'>
            {sorted.map((announcement) => {
              const publishedOn = formatPublishDate(
                announcement.publishDate,
                locale,
              )
              return (
                <Stack
                  key={announcement.id}
                  direction='column'
                  gap={2}
                  data-testid='whats-new-item'
                >
                  {publishedOn ? (
                    <Paragraph size='sm'>{publishedOn}</Paragraph>
                  ) : null}
                  <Heading as='h2' size='md'>
                    {announcement.title}
                  </Heading>
                  <div className='gi-paragraph-md gi-text-start gi-whitespace-normal'>
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeRaw, rehypeSanitize]}
                    >
                      {announcement.description}
                    </Markdown>
                  </div>
                </Stack>
              )
            })}
          </Stack>
        )}
      </Stack>
    </TwoColumnLayout>
  )
}
