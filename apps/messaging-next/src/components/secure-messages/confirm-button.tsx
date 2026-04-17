"use client"

import { faro, LogLevel } from "@grafana/faro-web-sdk"
import { Button, Spinner, toaster } from "@ogcio/design-system-react"
import { useGatewayMutation } from "@ogcio/sag-client/react"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { TRACE_MESSAGES, TRACES } from "@/const/traces"
import { withFaroSpan } from "@/util/trace-helpers"

interface Profile {
  id: string
  email: string
  primaryUserId: string
  preferredLanguage?: string
}

export function ConfirmButton({
  currentUserId,
  targetUserId,
  messageId,
}: {
  currentUserId: string
  targetUserId: string
  messageId: string
}) {
  const t = useTranslations("accountLinking")
  const router = useRouter()
  const pathname = usePathname()

  const { trigger, isLoading } = useGatewayMutation<Profile>(
    `/profile/api/v1/profiles/${targetUserId}`,
    { method: "PATCH" },
  )

  const handleConfirm = async () => {
    await withFaroSpan(
      TRACES.CONFIRM_ACCOUNT_LINKING,
      { currentUserId, targetUserId, messageId },
      async () => {
        try {
          const result = await trigger({ primaryUserId: currentUserId })
          faro.api.pushLog([
            TRACE_MESSAGES.CONFIRM_ACCOUNT_LINKING.SUCCESS,
            { context: { currentUserId, targetUserId, messageId } },
          ])

          const localePath = pathname.replace(/\/secure-messages$/, "")
          const lang = result?.preferredLanguage
          const base = lang
            ? pathname.replace(/\/[^/]+\/secure-messages$/, `/${lang}`)
            : localePath
          router.replace(`${base}/messages?id=${messageId}`)
        } catch (error) {
          faro.api.pushLog([
            TRACE_MESSAGES.CONFIRM_ACCOUNT_LINKING.ERROR,
            { context: { currentUserId, targetUserId, messageId, error } },
            { level: LogLevel.ERROR },
          ])

          toaster.create({
            title: t("error.linking"),
            description: t("error.server"),
            dismissible: true,
            duration: 5000,
            position: { x: "right", y: "top" },
            variant: "danger",
          })
        }
      },
    )
  }

  return (
    <Button disabled={isLoading} onClick={handleConfirm}>
      {t("confirm")}
      {isLoading && <Spinner />}
    </Button>
  )
}
