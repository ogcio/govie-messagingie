"use client"

import { Button, Paragraph, Spinner, Stack } from "@ogcio/design-system-react"
import { useAuth } from "@ogcio/sag-client/react"
import { useTranslations } from "next-intl"
import { useCallback, useState } from "react"
import { env } from "@/env/env.client"
import { DEFAULT_STACK_GAP } from "./const"

export function ServiceError() {
  const t = useTranslations("accountLinking")
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)

  const handleReport = useCallback(() => {
    setIsLoading(true)
    const formURL = new URL(
      env.NEXT_PUBLIC_ERROR_FORM_ID,
      env.NEXT_PUBLIC_FORMS_SERVICE_URL,
    ).toString()
    window.location.href = `${formURL}?userEmail=${encodeURIComponent(user?.email ?? "")}`
  }, [user?.email])

  return (
    <Stack direction='column' gap={DEFAULT_STACK_GAP}>
      <Paragraph>
        {t.rich("error.server", {
          bold: (chunks) => <b>{chunks}</b>,
        })}
      </Paragraph>
      <Button variant='secondary' disabled={isLoading} onClick={handleReport}>
        {t("report")}
        {isLoading && <Spinner />}
      </Button>
    </Stack>
  )
}
