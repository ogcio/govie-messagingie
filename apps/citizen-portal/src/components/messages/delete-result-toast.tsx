"use client"

import { toaster } from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"
import { useEffect } from "react"
import type { DeleteMessagesResult } from "./use-delete-messages"

export interface DeleteResultToastProps {
  result: DeleteMessagesResult | null
  onDismiss: () => void
}

/**
 * Headless component that surfaces the outcome of a soft-delete attempt
 * via the Design System `toaster` singleton. Replaces the earlier inline
 * `Alert` banner so the feedback shows up as a standard toast in the
 * portal mounted by `<ToastProvider />` in ClientShell.
 *
 * We always request `position: { x: "right", y: "top" }` here. On
 * mobile viewports the global stylesheet overrides the `top-right`
 * portal to behave like `top-center` (full-width, horizontally
 * centred), so the responsive layout is handled entirely in CSS — no
 * `matchMedia` drift.
 */
export function DeleteResultToast({
  result,
  onDismiss,
}: DeleteResultToastProps) {
  const t = useTranslations("home.delete.alert")

  useEffect(() => {
    if (!result) return
    const count = result.ids.length
    const title = result.ok ? t("success", { count }) : t("failure", { count })
    // `toaster.create` expects `ToastProps`, which extends `div` attributes,
    // so `data-*` is valid at runtime. TypeScript's excess-property check
    // rejects `data-testid` on a direct object literal at the call site, so
    // we stage the props in an inferred-typed variable first: once stored,
    // the literal is no longer "fresh" and the excess-property check no
    // longer runs when we hand it to `toaster.create`. Shape compatibility
    // (required `title`, valid `variant`, etc.) is still enforced.
    const toastProps = {
      title,
      variant: result.ok ? ("success" as const) : ("danger" as const),
      dismissible: true,
      duration: result.ok ? 5_000 : 8_000,
      position: { x: "right" as const, y: "top" as const },
      "data-testid": result.ok
        ? "delete-success-toast"
        : "delete-failure-toast",
    }
    toaster.create(toastProps)
    onDismiss()
  }, [result, t, onDismiss])

  return null
}
