export const MessageSecurityLevel = {
  PUBLIC: "public",
  CONFIDENTIAL: "confidential",
} as const

export type MessageSecurityLevel =
  (typeof MessageSecurityLevel)[keyof typeof MessageSecurityLevel]

export const forbiddenErrorMessage = "forbidden"
