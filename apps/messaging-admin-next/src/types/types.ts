import type { z } from "zod"
import type { getMessageTemplateContentSchema } from "@/types/schemas-server"
import { LANG_EN, LANG_GA } from "@/types/shared"
import type {
  baseEmailProviderSchema,
  baseMessageTemplateSchema,
  baseSendMessageSchema,
} from "./schemas"

type FieldErrorsOf<T extends z.ZodTypeAny> = ReturnType<
  z.ZodError<z.infer<T>>["flatten"]
>["fieldErrors"]

type MessageTemplateContentSchema = Awaited<
  ReturnType<typeof getMessageTemplateContentSchema>
>
type MessageTemplateContent = z.infer<MessageTemplateContentSchema>

type MessageTemplatePayload = {
  language: string
  richText?: string
} & MessageTemplateContent

type MessageTemplateFormData = {
  templateId: string | undefined
  languages: string[]
  [LANG_EN]?: MessageTemplateContent
  [LANG_GA]?: MessageTemplateContent
}

type MessageTemplatePayloadError = FieldErrorsOf<
  typeof baseMessageTemplateSchema
>
type EmailProviderPayloadError = FieldErrorsOf<typeof baseEmailProviderSchema>
type SendMessagePayloadError = FieldErrorsOf<typeof baseSendMessageSchema>

type TemplateContent = {
  language: string
  subject: string
  plainText: string
  richText?: string
  templateName: string
}

type TemplateListItem = {
  id: string
  contents: TemplateContent[]
}

type EmailProviderApiPayload = {
  id: string
  providerName: string
  fromAddress: string
  host: string
  port: number
  username: string
  isPrimary?: boolean
  headers?: Record<string, string>
}

type TemplateOptionApiPayload = TemplateListItem

type ProfilePayload = {
  id: string
  publicName: string
  email: string
  preferredLanguage?: string
  details?: { ppsn?: string }
  status?: string
  consentStatuses?: {
    messaging?: { status?: string }
  }
}

export type {
  EmailProviderApiPayload,
  EmailProviderPayloadError,
  MessageTemplateFormData,
  MessageTemplatePayload,
  MessageTemplatePayloadError,
  ProfilePayload,
  SendMessagePayloadError,
  TemplateContent,
  TemplateListItem,
  TemplateOptionApiPayload,
}

export type AppUser = {
  id: string
  isPublicServant: boolean
  isInactivePublicServant: boolean
  name?: string
  currentOrganization?: { name: string; id: string; roles: string[] }
  organizations?: { name: string; id: string; roles: string[] }[]
}
