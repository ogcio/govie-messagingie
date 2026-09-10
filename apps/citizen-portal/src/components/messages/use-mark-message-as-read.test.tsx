import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { markAsSeen, swrMutate } = vi.hoisted(() => ({
  markAsSeen: vi.fn(),
  swrMutate: vi.fn(),
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayMutation: () => ({ trigger: markAsSeen }),
}))
vi.mock("swr", () => ({ mutate: swrMutate }))

import { useMarkMessageAsRead } from "./use-mark-message-as-read"

describe("useMarkMessageAsRead", () => {
  beforeEach(() => {
    markAsSeen.mockReset()
    markAsSeen.mockResolvedValue(undefined)
    swrMutate.mockReset()
  })

  it("waits until the detail is ready", () => {
    renderHook(() => useMarkMessageAsRead("message-1", false))

    expect(markAsSeen).not.toHaveBeenCalled()
  })

  it("marks once and invalidates only message listings", async () => {
    const { rerender } = renderHook(
      ({ ready }) => useMarkMessageAsRead("message-1", ready),
      { initialProps: { ready: true } },
    )

    await waitFor(() => expect(swrMutate).toHaveBeenCalledOnce())
    expect(markAsSeen).toHaveBeenCalledWith({
      messageId: "message-1",
      isSeen: true,
    })

    const matchesListing = swrMutate.mock.calls[0]?.[0] as (
      key: unknown,
    ) => boolean
    expect(matchesListing("/messaging/api/v1/messages?page=1")).toBe(true)
    expect(
      matchesListing([
        "https://gateway/messaging/api/v1/messages?page=1",
        "citizen",
      ]),
    ).toBe(true)
    expect(matchesListing(["invalid"])).toBe(false)
    expect(matchesListing({})).toBe(false)
    expect(matchesListing("/messaging/api/v1/messages/message-1")).toBe(false)

    rerender({ ready: true })
    expect(markAsSeen).toHaveBeenCalledOnce()
  })

  it("does not invalidate listings when marking fails", async () => {
    markAsSeen.mockRejectedValueOnce(new Error("failed"))

    await act(async () => {
      renderHook(() => useMarkMessageAsRead("message-1", true))
    })

    await waitFor(() => expect(markAsSeen).toHaveBeenCalledOnce())
    expect(swrMutate).not.toHaveBeenCalled()
  })
})
