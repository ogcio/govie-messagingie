import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useMessageSelection } from "@/components/messages/use-message-selection"
import type { Message } from "@/types"

function makeMessage(id: string): Message {
  return {
    id,
    subject: `Subject ${id}`,
    createdAt: "2025-01-15T10:30:00Z",
    threadName: "Sender",
    organisationId: "org-1",
    recipientUserId: "user-1",
    isSeen: false,
  }
}

const page1: Message[] = ["a", "b", "c"].map(makeMessage)
const page2: Message[] = ["c", "d"].map(makeMessage)

describe("useMessageSelection", () => {
  it("starts with nothing selected", () => {
    const { result } = renderHook(() => useMessageSelection(page1))
    expect(result.current.selectedCount).toBe(0)
    expect(result.current.allSelected).toBe(false)
    expect(result.current.someSelected).toBe(false)
  })

  it("toggles individual messages", () => {
    const { result } = renderHook(() => useMessageSelection(page1))
    act(() => result.current.toggle("a"))
    expect(result.current.isSelected("a")).toBe(true)
    expect(result.current.someSelected).toBe(true)

    act(() => result.current.toggle("a"))
    expect(result.current.isSelected("a")).toBe(false)
  })

  it("selects all visible messages and unselects on second toggleAll", () => {
    const { result } = renderHook(() => useMessageSelection(page1))
    act(() => result.current.toggleAll())
    expect(result.current.allSelected).toBe(true)
    expect(result.current.selectedCount).toBe(3)

    act(() => result.current.toggleAll())
    expect(result.current.selectedCount).toBe(0)
  })

  it("prunes selection when the visible page changes", () => {
    const { result, rerender } = renderHook(
      ({ messages }) => useMessageSelection(messages),
      { initialProps: { messages: page1 } },
    )
    act(() => result.current.toggleAll())
    expect(result.current.selectedCount).toBe(3)

    rerender({ messages: page2 })

    expect(result.current.selectedCount).toBe(1)
    expect(result.current.isSelected("c")).toBe(true)
    expect(result.current.isSelected("a")).toBe(false)
  })

  it("clear removes the whole selection", () => {
    const { result } = renderHook(() => useMessageSelection(page1))
    act(() => result.current.toggleAll())
    act(() => result.current.clear())
    expect(result.current.selectedCount).toBe(0)
  })
})
