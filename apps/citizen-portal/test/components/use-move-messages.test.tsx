import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useMoveMessages } from "@/components/messages/use-move-messages"

const trigger = vi.fn()

vi.mock("@ogcio/sag-client/react", () => ({
  useGatewayMutation: () => ({ trigger, isLoading: false }),
}))

describe("useMoveMessages", () => {
  beforeEach(() => {
    trigger.mockReset()
    trigger.mockResolvedValue({ tagId: "tag-ehic", messageIds: ["msg-1"] })
  })

  it("assigns the tag and returns a deduped success result", async () => {
    const onSettled = vi.fn()
    const { result } = renderHook(() => useMoveMessages({ onSettled }))

    let moveResult: Awaited<ReturnType<typeof result.current.moveIds>>
    await act(async () => {
      moveResult = await result.current.moveIds(["msg-1", "msg-1"], "tag-ehic")
    })

    expect(trigger).toHaveBeenCalledWith({
      tagId: "tag-ehic",
      messageIds: ["msg-1"],
    })
    expect(moveResult!).toEqual({
      ok: true,
      ids: ["msg-1"],
      folderId: "tag-ehic",
    })
    expect(result.current.lastResult).toEqual(moveResult!)
    expect(onSettled).toHaveBeenCalledTimes(1)
  })

  it("returns a failure result when the gateway rejects", async () => {
    trigger.mockRejectedValueOnce(new Error("boom"))
    const { result } = renderHook(() => useMoveMessages())

    let moveResult: Awaited<ReturnType<typeof result.current.moveIds>>
    await act(async () => {
      moveResult = await result.current.moveIds(["msg-1"], null)
    })

    expect(moveResult!).toEqual({ ok: false, ids: ["msg-1"], folderId: null })
  })

  it("clears lastResult when dismissResult is called", async () => {
    const { result } = renderHook(() => useMoveMessages())

    await act(async () => {
      await result.current.moveIds(["msg-1"], null)
    })
    expect(result.current.lastResult).not.toBeNull()

    act(() => {
      result.current.dismissResult()
    })
    expect(result.current.lastResult).toBeNull()
  })
})
