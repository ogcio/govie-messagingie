import { describe, expect, it } from "vitest"
import {
  buildMessagesUrl,
  PAGE_SIZE,
} from "@/components/messages/pagination-utils"

describe("buildMessagesUrl", () => {
  describe("offset calculation (1-based page)", () => {
    it("calculates offset 0 for page 1", () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 1 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("offset")).toBe("0")
    })

    it("calculates offset equal to PAGE_SIZE for page 2", () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 2 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("offset")).toBe(String(PAGE_SIZE))
    })

    it("calculates offset equal to 2 * PAGE_SIZE for page 3", () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 3 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("offset")).toBe(String(2 * PAGE_SIZE))
    })

    it("uses (page - 1) * PAGE_SIZE formula consistently", () => {
      for (let page = 1; page <= 10; page++) {
        const url = buildMessagesUrl({ tab: "all", search: null, page })
        const params = new URLSearchParams(url.split("?")[1])
        expect(params.get("offset")).toBe(String((page - 1) * PAGE_SIZE))
      }
    })
  })

  describe("limit parameter", () => {
    it("always includes the correct limit", () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 1 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("limit")).toBe(String(PAGE_SIZE))
    })
  })

  describe("tab filtering", () => {
    it('includes isSeen=false for "unread" tab', () => {
      const url = buildMessagesUrl({ tab: "unread", search: null, page: 1 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("isSeen")).toBe("false")
    })

    it('does not include isSeen for "all" tab', () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 1 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.has("isSeen")).toBe(false)
    })

    it("preserves correct offset when switching tabs", () => {
      const unreadUrl = buildMessagesUrl({
        tab: "unread",
        search: null,
        page: 3,
      })
      const allUrl = buildMessagesUrl({ tab: "all", search: null, page: 3 })
      const unreadParams = new URLSearchParams(unreadUrl.split("?")[1])
      const allParams = new URLSearchParams(allUrl.split("?")[1])
      expect(unreadParams.get("offset")).toBe(allParams.get("offset"))
    })
  })

  describe("search filtering", () => {
    it("includes search param when provided", () => {
      const url = buildMessagesUrl({
        tab: "all",
        search: "hello",
        page: 1,
      })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("search")).toBe("hello")
    })

    it("does not include search param when null", () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 1 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.has("search")).toBe(false)
    })

    it("does not include search param when empty string", () => {
      const url = buildMessagesUrl({ tab: "all", search: "", page: 1 })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.has("search")).toBe(false)
    })

    it("preserves offset with search active", () => {
      const url = buildMessagesUrl({
        tab: "all",
        search: "test",
        page: 2,
      })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("offset")).toBe(String(PAGE_SIZE))
      expect(params.get("search")).toBe("test")
    })
  })

  describe("combined tab, search, and pagination", () => {
    it("handles unread tab with search on page 2", () => {
      const url = buildMessagesUrl({
        tab: "unread",
        search: "important",
        page: 2,
      })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("limit")).toBe(String(PAGE_SIZE))
      expect(params.get("offset")).toBe(String(PAGE_SIZE))
      expect(params.get("isSeen")).toBe("false")
      expect(params.get("search")).toBe("important")
    })

    it("handles all tab with search on page 1", () => {
      const url = buildMessagesUrl({
        tab: "all",
        search: "test",
        page: 1,
      })
      const params = new URLSearchParams(url.split("?")[1])
      expect(params.get("limit")).toBe(String(PAGE_SIZE))
      expect(params.get("offset")).toBe("0")
      expect(params.has("isSeen")).toBe(false)
      expect(params.get("search")).toBe("test")
    })
  })

  describe("url path", () => {
    it("returns the correct API path", () => {
      const url = buildMessagesUrl({ tab: "all", search: null, page: 1 })
      expect(url.startsWith("/messaging/api/v1/messages?")).toBe(true)
    })
  })
})
