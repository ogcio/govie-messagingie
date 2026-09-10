import { afterEach, describe, expect, it, vi } from "vitest"

describe("submission mocks", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("returns no fixtures when mocks are disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_MESSAGES", "false")
    const {
      findMockSubmissionById,
      getMockSubmissionsPage,
      getMockSubmissionsTotalCount,
    } = await import("./submissions")

    expect(
      getMockSubmissionsPage({ search: null, page: 1, pageSize: 10 }),
    ).toEqual([])
    expect(getMockSubmissionsTotalCount(null)).toBe(0)
    expect(findMockSubmissionById("SCH-2025-084321")).toBeNull()
  })

  it("paginates and finds enabled fixtures", async () => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_MESSAGES", "true")
    const {
      findMockSubmissionById,
      getMockSubmissionsPage,
      getMockSubmissionsTotalCount,
    } = await import("./submissions")

    const firstPage = getMockSubmissionsPage({
      search: null,
      page: 1,
      pageSize: 2,
    })
    const secondPage = getMockSubmissionsPage({
      search: null,
      page: 2,
      pageSize: 2,
    })

    expect(firstPage).toHaveLength(2)
    expect(secondPage).toHaveLength(2)
    expect(secondPage).not.toEqual(firstPage)
    expect(getMockSubmissionsTotalCount(null)).toBeGreaterThan(2)
    expect(findMockSubmissionById("SCH-2025-084321")?.title.en).toContain(
      "school",
    )
    expect(findMockSubmissionById("missing")).toBeNull()
  })

  it.each([
    ["sch-2025-084321", "SCH-2025-084321"],
    ["social housing", "SCH-2025-095478"],
    ["cláraigh breith", "SCH-2025-073296"],
  ])("searches fixtures for %s", async (search, expectedId) => {
    vi.stubEnv("NEXT_PUBLIC_ENABLE_MOCK_MESSAGES", "true")
    const { getMockSubmissionsPage } = await import("./submissions")

    expect(
      getMockSubmissionsPage({ search, page: 1, pageSize: 10 })[0]?.id,
    ).toBe(expectedId)
  })
})
