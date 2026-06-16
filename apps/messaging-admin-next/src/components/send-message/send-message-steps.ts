import type { MessageState } from "@/types/shared"

export type SendMessageStepKey =
  | "meta"
  | "recipients"
  | "attachments"
  | "schedule"
  | "success"

export type SendMessageStepDefinition = {
  key: SendMessageStepKey
  isValid: (message: Partial<MessageState>) => boolean
  next: SendMessageStepKey | null
  previous: SendMessageStepKey | null
}

export const SendMessageStepDefinitions: Record<
  SendMessageStepKey,
  SendMessageStepDefinition
> = {
  meta: {
    previous: null,
    key: "meta",
    isValid: ({ templateMetaId }) => Boolean(templateMetaId),
    next: "recipients",
  },
  recipients: {
    key: "recipients",
    isValid: ({ userIds }) => Boolean(userIds?.length),
    next: "attachments",
    previous: "meta",
  },
  attachments: {
    key: "attachments",
    isValid: () => true,
    next: "schedule",
    previous: "recipients",
  },
  schedule: {
    key: "schedule",
    previous: "attachments",
    isValid: ({ schedule }) => Boolean(schedule),
    next: "success",
  },
  success: {
    key: "success",
    previous: null,
    isValid: () => true,
    next: null,
  },
}
