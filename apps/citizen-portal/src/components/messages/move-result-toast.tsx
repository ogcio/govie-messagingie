"use client"

import { toaster } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import type { MoveMessagesResult } from "./use-move-messages"

export interface MoveResultToastProps {
  result: MoveMessagesResult | null
  onDismiss: () => void
}

export function MoveResultToast({ result, onDismiss }: MoveResultToastProps) {
  const t = useTranslations("home.move.alert")

  useEffect(() => {
    if (!result) return
    const count = result.ids.length
    const title = result.ok ? t("success", { count }) : t("failure", { count })
    const toastProps = {
      title,
      variant: result.ok ? ("success" as const) : ("danger" as const),
      dismissible: true,
      duration: result.ok ? 5_000 : 8_000,
      position: { x: "right" as const, y: "top" as const },
      "data-testid": result.ok ? "move-success-toast" : "move-failure-toast",
    }
    toaster.create(toastProps)
    onDismiss()
  }, [result, t, onDismiss])

  return null
}
