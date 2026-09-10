import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DeleteResultToast } from "@/components/messages/delete-result-toast"

/*
 * DS `toaster` is a module-level singleton that dispatches a CustomEvent
 * the `<ToastProvider />` portal listens to. We don't want (and don't
 * need) to mount the provider inside this unit test — asserting on the
 * outgoing `toaster.create` call is enough to lock in the contract.
 */
const createSpy = vi.fn()
vi.mock("@ogcio/design-system-react", () => ({
  toaster: {
    create: (args: unknown) => createSpy(args),
  },
}))

vi.mock("next-intl", () => ({
  useTranslations:
    (_namespace: string) =>
    (key: string, params?: { [k: string]: string | number }) => {
      const count = Number(params?.count) || 0
      if (key === "success") return `${count} messages have been deleted`
      if (key === "failure") return `${count} messages could not be deleted`
      return key
    },
}))

describe("DeleteResultToast", () => {
  beforeEach(() => {
    createSpy.mockReset()
  })

  it("does nothing when there is no result", () => {
    render(<DeleteResultToast result={null} onDismiss={vi.fn()} />)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it("fires a success toast with the translated title", () => {
    const onDismiss = vi.fn()
    render(
      <DeleteResultToast
        result={{ ok: true, ids: ["a", "b"] }}
        onDismiss={onDismiss}
      />,
    )
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "2 messages have been deleted",
        variant: "success",
        dismissible: true,
        "data-testid": "delete-success-toast",
      }),
    )
    // onDismiss must be called so the ambient result is cleared and the
    // effect doesn't re-enqueue the same toast on subsequent renders.
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it("fires a danger toast on failure with a longer duration", () => {
    const onDismiss = vi.fn()
    render(
      <DeleteResultToast
        result={{ ok: false, ids: ["a", "b"] }}
        onDismiss={onDismiss}
      />,
    )
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "2 messages could not be deleted",
        variant: "danger",
        "data-testid": "delete-failure-toast",
        duration: 8_000,
      }),
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
