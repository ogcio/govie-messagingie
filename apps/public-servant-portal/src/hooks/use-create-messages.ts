"use client"

import type { SagClient } from "@ogcio/sag-client"
import { ORGANIZATION_ID_HEADER, SagFetchError } from "@ogcio/sag-client"
import { useSagClient } from "@ogcio/sag-client/react"
import { MessageSecurityLevel } from "@/const/messaging"
import { useOrganizationId } from "@/hooks/use-organization-id"
import type { MessageState } from "@/types/shared"
import { LANG_EN } from "@/types/shared"
import { messagingApi } from "@/util/api-paths"

type TemplateResponse = {
  contents: Array<{
    language: string
    subject: string
    plainText: string
    richText?: string
    templateName: string
  }>
}

type ProfilePayload = {
  id: string
  publicName: string
  email: string
  preferredLanguage?: string
  details?: { ppsn?: string }
}

async function uploadFileViaGateway(
  client: SagClient,
  path: string,
  file: File,
  organizationId?: string,
): Promise<string> {
  const form = new FormData()
  form.append("file", file)

  const headers: Record<string, string> = {
    "X-Application": client.appName,
  }
  if (organizationId) {
    headers[ORGANIZATION_ID_HEADER] = organizationId
  }

  const response = await fetch(`${client.gatewayUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers,
    body: form,
  })

  if (!response.ok) {
    let message = `HTTP error! status: ${response.status} ${response.statusText}`
    try {
      const body = (await response.json()) as {
        error?: string
        details?: string
        detail?: string
      }
      message = body.details ?? body.detail ?? body.error ?? message
    } catch {
      // keep default message
    }
    throw new SagFetchError(message, response.status)
  }

  const body = (await response.json()) as { data?: { id?: string } }
  const id = body.data?.id
  if (!id) {
    throw new Error(`Failed to upload ${file.name}`)
  }
  return id
}

export function useCreateMessages() {
  const client = useSagClient()
  const organizationId = useOrganizationId()

  return async function createMessages({
    templateMetaId,
    userIds,
    schedule,
    securityLevel,
    pendingFiles,
  }: Partial<MessageState> & { pendingFiles?: File[] }): Promise<{
    created: number
    errors: Record<string, string>
    schedule?: string
  }> {
    if (!templateMetaId || !userIds?.filter(Boolean)?.length || !schedule) {
      return { created: 0, errors: {} }
    }

    const opts = organizationId ? { organizationId } : undefined

    let template: TemplateResponse | undefined
    try {
      const { data } = await client.fetch<TemplateResponse>(
        messagingApi.template(templateMetaId),
        opts,
      )
      template = data
    } catch (err) {
      return {
        created: 0,
        errors: {
          api: err instanceof Error ? err.message : "Failed to load template",
        },
      }
    }

    if (!template?.contents?.length) {
      return { created: 0, errors: { api: "Template not found" } }
    }

    let profiles: ProfilePayload[] = []
    try {
      const { data } = await client.fetch<ProfilePayload[]>(
        messagingApi.profiles(userIds.join(",")),
        opts,
      )
      profiles = data ?? []
    } catch (err) {
      return {
        created: 0,
        errors: {
          api: err instanceof Error ? err.message : "Failed to load recipients",
        },
      }
    }

    const uploadIds: string[] = []
    if (pendingFiles?.length) {
      try {
        for (const file of pendingFiles) {
          const id = await uploadFileViaGateway(
            client,
            messagingApi.uploadFile(),
            file,
            organizationId,
          )
          uploadIds.push(id)
        }
      } catch (err) {
        return {
          created: 0,
          errors: {
            api: err instanceof Error ? err.message : "Failed to upload files",
          },
        }
      }

      const recipients = userIds.filter(Boolean)
      try {
        await Promise.all(
          uploadIds.map((fileId) =>
            client.mutate(
              messagingApi.shareFile(),
              "POST",
              { fileId, userIds: recipients },
              opts,
            ),
          ),
        )
      } catch (err) {
        return {
          created: 0,
          errors: {
            api:
              err instanceof Error
                ? err.message
                : "Failed to share attachments",
          },
        }
      }
    }

    let created = 0
    const errors: Record<string, string> = {}

    for (const userId of userIds) {
      const profile = profiles.find((p) => p.id === userId)
      if (!profile) {
        errors[userId] = "Profile not found"
        continue
      }

      const preferredLanguage = template.contents.some(
        (c) => c.language === profile.preferredLanguage,
      )
        ? profile.preferredLanguage
        : template.contents.at(0)?.language || LANG_EN

      const content =
        template.contents.find((c) => c.language === preferredLanguage) ??
        template.contents[0]

      const interpolations: Record<string, string> = {
        publicName: profile.publicName,
        email: profile.email,
        ppsn: profile.details?.ppsn ?? "",
      }

      const interpolate = (text: string) =>
        text.replace(
          /\{\{(\w+)\}\}/g,
          (_, key: string) => interpolations[key] ?? `{{${key}}}`,
        )

      const messageBody = {
        threadName: interpolate(content.subject),
        subject: interpolate(content.subject),
        excerpt: interpolate(content.plainText).slice(0, 200),
        plainText: interpolate(content.plainText),
        richText: interpolate(content.richText ?? content.plainText),
        language: preferredLanguage,
      }

      try {
        await client.mutate(
          messagingApi.sendMessages(),
          "POST",
          {
            preferredTransports: ["email"],
            recipientUserId: userId,
            security: securityLevel ?? MessageSecurityLevel.CONFIDENTIAL,
            scheduleAt: schedule,
            message: messageBody,
            ...(uploadIds.length > 0 && { attachments: uploadIds }),
          },
          opts,
        )
        created += 1
      } catch (err) {
        errors[userId] =
          err instanceof Error ? err.message : "Failed to send message"
      }
    }

    return { created, errors, schedule }
  }
}
