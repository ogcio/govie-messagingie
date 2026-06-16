"use client"

import { useCrossZoneLink } from "@citizen-portal/shared"
import {
  FormField,
  Heading,
  Link,
  Paragraph,
  Spinner,
  Stack,
} from "@ogcio/design-system-react"
import { SagFetchError } from "@ogcio/sag-client"
import { useAuth, useGatewayFetch } from "@ogcio/sag-client/react"
import { useLocale, useTranslations } from "next-intl"
import { FullWidthContainer } from "@/components/layout/containers"
import { BoldLink } from "@/components/navigation/bold-link"

interface Message {
  id: string
  subject: string
  createdAt: string
}

/**
 * Recent-messages preview card shown on the dashboard landing.
 *
 * Always cross-zones to the messages app for the "view all" CTA and
 * per-message deep links — even after the consolidation, those routes
 * live on the messaging hostname (Phase C keeps cross-zone hard-nav
 * for URL-content parity).
 */
export function MyMessages() {
  const t = useTranslations("dashboard.messages")
  const locale = useLocale()
  const { user, loading: authLoading } = useAuth()
  const crossZone = useCrossZoneLink()

  const messagesPath = user ? "/messaging/api/v1/messages/?limit=3" : null

  const {
    data: messages,
    error,
    isLoading,
  } = useGatewayFetch<Message[]>(messagesPath)

  const hasTransientAuthError =
    !messages?.length && error instanceof SagFetchError && error.status === 401

  const isWaitingForMessages =
    authLoading || !messagesPath || isLoading || hasTransientAuthError

  return (
    /*
     * `fixedHeight="auto"` overrides DS Stack's default `height: 100%`.
     * Without it the dashboard's left column stretches to the height of
     * the gov.ie card on its right (via CSS Grid `align-items: stretch`)
     * and the "View all messages" CTA gets pushed to the bottom of that
     * stretched box, leaving a large vertical gap between the message
     * list and the button. Sizing to content keeps the button glued
     * right under the list regardless of the neighbouring column.
     */
    <Stack direction='column' gap={5} fixedHeight='auto'>
      <Heading as='h3'>{t("title")}</Heading>
      {isWaitingForMessages ? (
        <output
          aria-label='Loading messages'
          className='gi-flex gi-items-center gi-justify-center'
        >
          <Spinner size='lg' />
        </output>
      ) : messages?.length ? (
        <Stack direction='column' gap={5} fixedHeight='auto' hasDivider>
          {messages.map(({ id, subject, createdAt }) => (
            <FullWidthContainer key={id}>
              <Paragraph>
                {new Date(createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Paragraph>
              <BoldLink
                href={crossZone("messages", `/${locale}/messages?id=${id}`)}
              >
                {subject}
              </BoldLink>
            </FullWidthContainer>
          ))}
        </Stack>
      ) : (
        <Paragraph>{t("empty")}</Paragraph>
      )}
      {error != null &&
        !isWaitingForMessages &&
        !(error instanceof SagFetchError && error.status === 401) && (
          <FormField
            error={{
              text: t("error", {
                message:
                  error instanceof Error ? error.message : "Unknown error",
              }),
            }}
          />
        )}
      <Link
        href={crossZone("messages", `/${locale}/messages`)}
        asButton={{}}
        className='gi-mt-3'
      >
        {t("link")}
      </Link>
    </Stack>
  )
}
