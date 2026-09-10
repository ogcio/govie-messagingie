import { beforeEach, describe, expect, it, vi } from "vitest"

const queryMock = vi.fn()
vi.mock("../pg", () => ({
  profilePool: { query: (...args: unknown[]) => queryMock(...args) },
  messagePool: { query: vi.fn() },
}))

const {
  queryAssociatedProfileIds,
  queryConsentsForProfile,
  queryProfile,
  queryProfileLinkDetails,
  queryRelatedUsersByUserId,
} = await import("./pgAccess")

beforeEach(() => {
  queryMock.mockReset()
})

describe("queryRelatedUsersByUserId", () => {
  const row = {
    id: "u-1",
    primary_user_id: "u-1",
    email: "u1@test.ie",
    public_name: "User One",
  }

  it("returns the related rows for the user id", async () => {
    queryMock.mockResolvedValue({ rows: [row] })

    const result = await queryRelatedUsersByUserId("u-1")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual([row])
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1"])
  })

  it("fails with profile-not-found when no rows match", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    const result = await queryRelatedUsersByUserId("nobody")

    expect(result.success).toBe(false)
  })

  it("fails when the query throws", async () => {
    queryMock.mockRejectedValue(new Error("pg down"))

    const result = await queryRelatedUsersByUserId("u-1")

    expect(result.success).toBe(false)
  })
})

describe("queryProfileLinkDetails", () => {
  const row = {
    id: "u-1",
    primary_user_id: "u-1",
    email: "u1@test.ie",
    public_name: "User One",
    links: [],
  }

  it("passes the lookup value and type as parameters", async () => {
    queryMock.mockResolvedValue({ rows: [row] })

    const result = await queryProfileLinkDetails({
      type: "email",
      value: "u1@test.ie",
    })

    expect(result.success).toBe(true)
    expect(queryMock.mock.calls[0][1]).toEqual(["u1@test.ie", "email"])
  })

  it("fails when no profile matches", async () => {
    queryMock.mockResolvedValue({ rows: [] })

    const result = await queryProfileLinkDetails({ type: "id", value: "u-x" })

    expect(result.success).toBe(false)
  })
})

describe("queryProfile", () => {
  it("returns the rows for the profile id", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: "u-1" }] })

    const result = await queryProfile("u-1")

    expect(result.success).toBe(true)
    expect(queryMock.mock.calls[0][1]).toEqual(["u-1"])
  })

  it("fails when the query throws", async () => {
    queryMock.mockRejectedValue(new Error("pg down"))

    const result = await queryProfile("u-1")

    expect(result.success).toBe(false)
  })
})

describe("queryAssociatedProfileIds", () => {
  it("maps rows to plain ids", async () => {
    queryMock.mockResolvedValue({ rows: [{ id: "a" }, { id: "b" }] })

    const result = await queryAssociatedProfileIds("u-1")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual(["a", "b"])
  })

  it("fails when the query throws", async () => {
    queryMock.mockRejectedValue(new Error("pg down"))

    const result = await queryAssociatedProfileIds("u-1")

    expect(result.success).toBe(false)
  })
})

describe("queryConsentsForProfile", () => {
  it("returns consent rows", async () => {
    const consent = {
      id: "c-1",
      createdAt: "2025-01-01",
      subject: "marketing",
      status: "opted-in",
      version: "1.0",
      cascadeReason: null,
    }
    queryMock.mockResolvedValue({ rows: [consent] })

    const result = await queryConsentsForProfile("u-1")

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.value).toEqual([consent])
  })

  it("fails when the query throws", async () => {
    queryMock.mockRejectedValue(new Error("pg down"))

    const result = await queryConsentsForProfile("u-1")

    expect(result.success).toBe(false)
  })
})
