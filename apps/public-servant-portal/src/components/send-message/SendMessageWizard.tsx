"use client"

import { ProgressStepper, Stack, StepItem } from "@ogcio/design-system-react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { useContext, useEffect } from "react"
import { defaultFormGap } from "@/util/datetime"
import { SendMessageContext, SendMessageSteps } from "./SendMessageContext"

const stepMap: Record<keyof typeof SendMessageSteps, number> = {
  meta: 0,
  recipients: 1,
  attachments: 2,
  schedule: 3,
  success: 4,
}

const SendMessageWizard = () => {
  const t = useTranslations("message.wizard.step")
  const { step, setStep } = useContext(SendMessageContext)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const requestedStep = searchParams.get("step")

  // Honour a `?step=recipients` deep-link by advancing the wizard and stripping
  // the query. Doing this during render triggers a setState during render
  // warning and, combined with the analytics `history.replaceState` patch under
  // `output: "export"`, can cause a hard reload loop. Run it in an effect.
  useEffect(() => {
    if (requestedStep !== "recipients") return
    setStep(SendMessageSteps.recipients)
    router.replace(pathname)
  }, [requestedStep, setStep, router, pathname])

  if (requestedStep === "recipients" && step.key !== "recipients") {
    return null
  }

  return (
    <Stack direction='column' gap={defaultFormGap}>
      <ProgressStepper
        currentStepIndex={stepMap[step.key as keyof typeof stepMap]}
        indicator='number'
      >
        <StepItem label={t("meta.label.progress")} />
        <StepItem label={t("recipient.label.progress")} />
        <StepItem label={t("attachments.label.progress")} />
        <StepItem label={t("schedule.label.progress")} />
        <StepItem label={t("success.label.progress")} />
      </ProgressStepper>
      <step.component />
    </Stack>
  )
}

export { SendMessageWizard }
