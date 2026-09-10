import { render } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MoveResultToast } from "@/components/messages/move-result-toast"

const createSpy = vi.fn()
vi.mock("@ogcio/design-system-react", () => ({
  toaster: {
    create: (args: unknown) => createSpy(args),
  },
}))

vi.mock("next-intl", () => ({
  useTranslations:
    () => (key: string, params?: { [k: string]: string | number }) => {
      const count = Number(params?.count) || 0
      if (key === "success") return `${count} messages have been moved`
      if (key === "failure") return `${count} messages could not be moved`
      return key
    },
}))

describe("MoveResultToast", () => {
  beforeEach(() => {
    createSpy.mockReset()
  })

  it("does nothing when there is no result", () => {
    render(<MoveResultToast result={null} onDismiss={vi.fn()} />)
    expect(createSpy).not.toHaveBeenCalled()
  })

  it("fires a success toast with the translated title", () => {
    const onDismiss = vi.fn()
    render(
      <MoveResultToast
        result={{ ok: true, ids: ["a"], folderId: "mock-folder-ehic" }}
        onDismiss={onDismiss}
      />,
    )
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "1 messages have been moved",
        variant: "success",
        "data-testid": "move-success-toast",
      }),
    )
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
