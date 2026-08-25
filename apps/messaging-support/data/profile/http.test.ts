import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fetchCreateLifecycleTask, fetchExportTask } from "./http"

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({ PROFILE_API_RESOURCE_URL: "https://profile.test/" }),
}))

describe("fetchCreateLifecycleTask", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("posts an export_user_data task to the lifecycle-tasks endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) })

    const result = await fetchCreateLifecycleTask({
      bearerToken: "token-1",
      type: "export_user_data",
      profileId: "profile-1",
      requesterUserId: "agent-1",
    })

    expect(result.success).toBe(true)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe("https://profile.test/api/v1/lifecycle-tasks")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({
      type: "export_user_data",
      profileId: "profile-1",
      requesterUserId: "agent-1",
    })
    expect(init.headers.Authorization).toBe("Bearer token-1")
  })

  it("posts a delete_profile task to the lifecycle-tasks endpoint", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ data: {} }) })

    const result = await fetchCreateLifecycleTask({
      bearerToken: "token-1",
      type: "delete_profile",
      profileId: "profile-1",
      requesterUserId: "agent-1",
    })

    expect(result.success).toBe(true)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe("https://profile.test/api/v1/lifecycle-tasks")
    expect(init.method).toBe("POST")
    expect(JSON.parse(init.body)).toEqual({
      type: "delete_profile",
      profileId: "profile-1",
      requesterUserId: "agent-1",
    })
    expect(init.headers.Authorization).toBe("Bearer token-1")
  })

  it("fails when the API rejects the request", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "nope" }),
    })

    const result = await fetchCreateLifecycleTask({
      bearerToken: "token-1",
      type: "export_user_data",
      profileId: "profile-1",
      requesterUserId: "agent-1",
    })

    expect(result.success).toBe(false)
  })
})

describe("fetchExportTask", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock)
    fetchMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the first export task for the profile", async () => {
    const task = {
      id: "task-1",
      type: "export_user_data",
      status: "completed",
      metadata: { expiresAt: "2026-09-01T00:00:00.000Z", uploadId: "upload-1" },
    }
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tasks: [task] } }),
    })

    const result = await fetchExportTask({
      bearerToken: "token-1",
      profileId: "profile-1",
    })

    expect(result).toEqual({
      success: true,
      value: {
        id: "task-1",
        status: "completed",
        metadata: {
          expiresAt: "2026-09-01T00:00:00.000Z",
          uploadId: "upload-1",
        },
      },
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toBe(
      "https://profile.test/api/v1/lifecycle-tasks/search",
    )
    expect(init.method).toBe("POST")
    expect(init.headers.Authorization).toBe("Bearer token-1")
    expect(JSON.parse(init.body)).toEqual({
      profileId: "profile-1",
      taskType: "export_user_data",
    })
  })

  it("returns null when the profile has no export task", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tasks: [] } }),
    })

    const result = await fetchExportTask({
      bearerToken: "token-1",
      profileId: "profile-1",
    })

    expect(result).toEqual({ success: true, value: null })
  })

  it("fails when the response payload has an unexpected shape", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ data: { tasks: null } }),
    })

    const result = await fetchExportTask({
      bearerToken: "token-1",
      profileId: "profile-1",
    })

    expect(result.success).toBe(false)
  })

  it("fails when the API rejects the search request", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "nope" }),
    })

    const result = await fetchExportTask({
      bearerToken: "token-1",
      profileId: "profile-1",
    })

    expect(result.success).toBe(false)
  })
})
