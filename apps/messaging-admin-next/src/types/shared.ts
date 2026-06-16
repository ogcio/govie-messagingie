import type { MessageSecurityLevel } from "@/const/messaging"

export const LANG_EN = "en" as const
export const LANG_GA = "ga" as const
export const AVAILABLE_LANGUAGES = [LANG_EN, LANG_GA] as const
export const DUBLIN_TIMEZONE = "Europe/Dublin"

export type FormError = {
  messageKey: string
  field: string
  errorValue: string
}

export type RecipientContact = {
  id: string
  emailAddress?: string
  phoneNumber?: string
  firstName: string
  lastName: string
}

export type AwsState = {
  name: string
  type: "AWS"
  accessKey: string
  secretAccessKey: string
  region: string
}

export type MessageState = {
  organisationId: string
  threadName: string
  securityLevel: MessageSecurityLevel
  subject: string
  excerpt: string
  richText: string
  plainText: string
  submittedAt: string
  transports: string[]
  schedule: string
  userIds: string[]
  templateMetaId: string
  templateName: string
  templateInterpolations: Record<string, string>
  successfulMessagesCreated: number
  attachments: { fileName: string; fileSize: number }[]
  errors?: Record<string, string>
}

export type EmailProviderInput = {
  id?: string
  providerName: string
  smtpHost: string
  smtpPort: number
  username: string
  password?: string
  fromAddress: string
  throttle?: number
  ssl?: boolean
  isPrimary?: boolean
  headers?: Record<string, string>
}

export type UpdateProviderInput = EmailProviderInput & { id: string }
export type CreateProviderInput = EmailProviderInput & { password: string }
