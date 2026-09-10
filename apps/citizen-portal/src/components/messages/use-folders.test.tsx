import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { gateway, useGatewayFetch } = vi.hoisted(() => ({
  gateway: {
    data: undefined as
      | { id: string; label: string; parentTagId: string | null }[]
      | undefined,
    isLoading: false,
    error: undefined as unknown,
    refresh: vi.fn(),
  },
  useGatewayFetch: vi.fn(),
}))

vi.mock("@ogcio/sag-client/react", () => ({ useGatewayFetch }))

import { useFolders } from "./use-folders"
import { useMessageFolders } from "./use-message-folders"

describe("folder hooks", () => {
  beforeEach(() => {
    gateway.data = undefined
    gateway.isLoading = false
    gateway.error = undefined
    gateway.refresh.mockReset()
    useGatewayFetch.mockImplementation(() => gateway)
  })

  it("returns an empty list before folders load and refreshes", () => {
    const { result } = renderHook(useFolders)

    expect(result.current.folders).toEqual([])
    act(() => result.current.refresh())
    expect(gateway.refresh).toHaveBeenCalledOnce()
  })

  it("maps API tags to folders", () => {
    gateway.data = [
      { id: "one", label: "One", parentTagId: null },
      { id: "two", label: "Two", parentTagId: "parent" },
    ]

    const { result } = renderHook(useFolders)
    expect(result.current.folders).toEqual([
      { id: "one", label: "One" },
      { id: "two", label: "Two" },
    ])
  })

  it("offers all folders from the inbox", () => {
    gateway.data = [
      { id: "one", label: "One", parentTagId: null },
      { id: "two", label: "Two", parentTagId: null },
    ]

    const { result } = renderHook(() =>
      useMessageFolders({ currentFolderId: null, inboxLabel: "Inbox" }),
    )
    expect(result.current).toEqual([
      { id: "one", label: "One" },
      { id: "two", label: "Two" },
    ])
  })

  it("offers the inbox and excludes the current folder", () => {
    gateway.data = [
      { id: "one", label: "One", parentTagId: null },
      { id: "two", label: "Two", parentTagId: null },
    ]

    const { result } = renderHook(() =>
      useMessageFolders({ currentFolderId: "one", inboxLabel: "Inbox" }),
    )
    expect(result.current).toEqual([
      { id: null, label: "Inbox" },
      { id: "two", label: "Two" },
    ])
  })
})
