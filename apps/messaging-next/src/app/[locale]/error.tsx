"use client"

import { faro } from "@grafana/faro-web-sdk"
import { Button, Heading, Paragraph, Stack } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations("errors.page")

  useEffect(() => {
    faro.api?.pushLog([`Error: ${error.message}`])
  }, [error])

  return (
    <Stack
      direction='column'
      gap={4}
      role='alert'
      aria-live='assertive'
      aria-atomic='true'
    >
      <Heading as='h1'>{t("title")}</Heading>
      <Paragraph>{t("message")}</Paragraph>
      {error.message && (
        <Paragraph size='sm'>
          <span className='gi-sr-only'>{t("title")}: </span>
          {error.message}
        </Paragraph>
      )}
      <div>
        <Button onClick={reset}>{t("retry")}</Button>
      </div>
    </Stack>
  )
}
