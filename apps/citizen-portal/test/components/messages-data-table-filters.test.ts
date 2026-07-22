import { describe, expect, it, vi } from "vitest"
import {
  activeMessageFilterLabels,
  emptyMessageFilters,
  messageFiltersFromStatusParam,
  statusParamFromMessageFilters,
} from "@/components/messages/messages-data-table-filters"

describe("messages-data-table-filters", () => {
  it("maps status URL params to filter state", () => {
    expect(messageFiltersFromStatusParam(null)).toEqual(emptyMessageFilters)
    expect(messageFiltersFromStatusParam("all")).toEqual(emptyMessageFilters)
    expect(messageFiltersFromStatusParam("unread")).toEqual({
      selectedStatuses: ["unread"],
    })
    expect(messageFiltersFromStatusParam("read")).toEqual({
      selectedStatuses: ["read"],
    })
  })

  it("maps a single selected status back to the URL param", () => {
    expect(statusParamFromMessageFilters(emptyMessageFilters)).toBeNull()
    expect(
      statusParamFromMessageFilters({ selectedStatuses: ["unread"] }),
    ).toBe("unread")
    expect(statusParamFromMessageFilters({ selectedStatuses: ["read"] })).toBe(
      "read",
    )
    expect(
      statusParamFromMessageFilters({
        selectedStatuses: ["unread", "read"],
      }),
    ).toBeNull()
  })

  it("builds active filter chip labels", () => {
    expect(
      activeMessageFilterLabels({
        filters: { selectedStatuses: ["unread"] },
        labels: { unread: "Unread", read: "Read" },
      }),
    ).toEqual([{ id: "unread", label: "Unread" }])
  })
})

describe("mock message status filtering", () => {
  it("filters mock fixtures by read state when mocks are enabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_MESSAGES", "true")
    vi.resetModules()

    const { getMockMessagesPage } = await import("@/mock/messages")

    const unreadOnly = getMockMessagesPage({
      search: null,
      page: 1,
      pageSize: 50,
      status: "unread",
    })
    const readOnly = getMockMessagesPage({
      search: null,
      page: 1,
      pageSize: 50,
      status: "read",
    })

    expect(unreadOnly.every((message) => !message.isSeen)).toBe(true)
    expect(readOnly.every((message) => message.isSeen)).toBe(true)
    expect(unreadOnly.length).toBeGreaterThan(0)
    expect(readOnly.length).toBeGreaterThan(0)

    vi.unstubAllEnvs()
  })
})

describe("debounce", () => {
  it("delays invocation and can be cancelled", async () => {
    vi.useFakeTimers()
    const { debounce } = await import("@/components/messages/debounce")
    const fn = vi.fn()
    const debounced = debounce(fn, 500)

    debounced("a")
    debounced("b")
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(500)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith("b")

    debounced.cancel()
    vi.useRealTimers()
  })
})
