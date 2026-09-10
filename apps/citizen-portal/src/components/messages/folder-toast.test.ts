import { beforeEach, describe, expect, it, vi } from "vitest"

const create = vi.hoisted(() => vi.fn())

vi.mock("@ogcio/design-system-react", () => ({
  toaster: { create },
}))

import { showFolderToast } from "./folder-toast"

describe("showFolderToast", () => {
  beforeEach(() => create.mockClear())

  it("shows the default success toast", () => {
    showFolderToast("Folder created")

    expect(create).toHaveBeenCalledWith({
      title: "Folder created",
      variant: "success",
      dismissible: true,
      duration: 4_000,
      position: { x: "right", y: "top" },
      "data-testid": "folder-toast",
    })
  })

  it("keeps danger toasts visible longer and accepts a test id", () => {
    showFolderToast("Folder failed", {
      variant: "danger",
      testId: "folder-error",
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: "danger",
        duration: 8_000,
        "data-testid": "folder-error",
      }),
    )
  })
})
