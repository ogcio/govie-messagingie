"use client"

import { toaster } from "@ogcio/design-system-react"

/**
 * Surfaces a folder-action confirmation via the DS `toaster` singleton
 * (top-right on desktop, full-width top on mobile via the global stylesheet).
 * Auto-dismisses after 4s per the design spec; failures stay longer so the
 * user can read them.
 *
 * `data-testid` is staged in a typed local first so TypeScript's
 * excess-property check doesn't reject the `data-*` key on the literal —
 * matching the pattern used by the delete/move result toasts.
 */
export function showFolderToast(
  title: string,
  options: { variant?: "success" | "danger"; testId?: string } = {},
) {
  const { variant = "success", testId = "folder-toast" } = options
  const toastProps = {
    title,
    variant,
    dismissible: true,
    duration: variant === "success" ? 4_000 : 8_000,
    position: { x: "right" as const, y: "top" as const },
    "data-testid": testId,
  }
  toaster.create(toastProps)
}
