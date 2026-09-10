"use client"

import { createContext, useState } from "react"
import { useUser, useUserRoles } from "@/components/UserContext"
import { MessageSecurityLevel } from "@/const/messaging"
import type { MessageState } from "@/types/shared"
import AttachmentsForm from "./AttachmentsForm"
import ComposeMessageMeta from "./ComposeMessageMeta"
import Recipients from "./Recipients"
import ScheduleForm from "./ScheduleForm"
import SuccessForm from "./SuccessForm"
import {
  SendMessageStepDefinitions,
  type SendMessageStepKey,
} from "./send-message-steps"

const stepComponents = {
  meta: ComposeMessageMeta,
  recipients: Recipients,
  attachments: AttachmentsForm,
  schedule: ScheduleForm,
  success: SuccessForm,
} as const

type SendMessageStep =
  (typeof SendMessageStepDefinitions)[SendMessageStepKey] & {
    // biome-ignore lint/suspicious/noExplicitAny: legacy
    component: any
  }

export const SendMessageSteps = Object.fromEntries(
  Object.entries(SendMessageStepDefinitions).map(([key, definition]) => [
    key,
    { ...definition, component: stepComponents[key as SendMessageStepKey] },
  ]),
) as Record<SendMessageStepKey, SendMessageStep>

type SendMessageContextType = {
  userId: string
  canCreateProfiles: boolean
  canUploadFiles: boolean
  searchParams: Record<string, string>
  message: Partial<MessageState>
  pendingFiles: File[]
  step: SendMessageStep
  errors: {
    api?: Record<string, { detail: string }>
    server?: string
  }
  setMessage: (message: SendMessageContextType["message"]) => void
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>
  setSearchParams: (
    searchParams: SendMessageContextType["searchParams"],
  ) => void
  onStep: (
    message: SendMessageContextType["message"],
    d: "next" | "previous",
  ) => void
  setErrors: React.Dispatch<
    React.SetStateAction<SendMessageContextType["errors"]>
  >
  setStep: (step: SendMessageStep) => void
}

const SendMessageContext = createContext<SendMessageContextType>({
  userId: "",
  searchParams: {},
  canCreateProfiles: false,
  canUploadFiles: false,
  message: {},
  pendingFiles: [],
  setMessage: () => {},
  setPendingFiles: () => {},
  setSearchParams: () => {},
  step: SendMessageSteps.meta,
  onStep: () => {},
  errors: {},
  setErrors: () => {},
  setStep: () => {},
})

const SendMessageProvider = ({ children }: { children: React.ReactNode }) => {
  const user = useUser()
  const { canCreateProfiles, canUploadFiles } = useUserRoles()

  const [message, setMessage] = useState<SendMessageContextType["message"]>({
    excerpt: undefined,
    plainText: undefined,
    richText: undefined,
    schedule: undefined,
    securityLevel: MessageSecurityLevel.CONFIDENTIAL,
    subject: undefined,
    submittedAt: undefined,
    threadName: undefined,
    transports: [],
    userIds: [],
    templateMetaId: undefined,
    templateInterpolations: {},
    successfulMessagesCreated: 0,
    attachments: [],
  })

  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [step, setStep] = useState<SendMessageContextType["step"]>(
    SendMessageSteps.meta,
  )
  const [localSearchParams, setLocalSearchParams] = useState<
    SendMessageContextType["searchParams"]
  >({})
  const [errors, setErrors] = useState<SendMessageContextType["errors"]>({})

  const onStep = (
    updatedMessage: SendMessageContextType["message"],
    direction: "next" | "previous",
  ) => {
    setMessage((prevMessage) => ({
      ...prevMessage,
      ...updatedMessage,
      submittedAt: direction === "next" ? new Date().toISOString() : "",
    }))

    const key = direction === "next" ? step.next : step.previous
    if (!key) return

    const nextStep = SendMessageSteps[key]
    if (nextStep) setStep(nextStep)
  }

  return (
    <SendMessageContext.Provider
      value={{
        userId: user.id,
        canCreateProfiles,
        canUploadFiles,
        searchParams: localSearchParams,
        setSearchParams: setLocalSearchParams,
        message,
        pendingFiles,
        setMessage,
        setPendingFiles,
        step,
        onStep,
        errors,
        setErrors,
        setStep,
      }}
    >
      {children}
    </SendMessageContext.Provider>
  )
}

export { SendMessageStepDefinitions } from "./send-message-steps"
export { SendMessageContext, SendMessageProvider }
