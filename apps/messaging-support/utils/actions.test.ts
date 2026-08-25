import { beforeEach, describe, expect, it, vi } from "vitest"
import { emitAuditOnce } from "@/data/audit"
import { ProfileDataService } from "@/data/profile"
import { getIdentity } from "./session"

vi.mock("@/data/profile", () => ({
  ProfileDataService: {
    requestDataExport: vi.fn(),
  },
}))

vi.mock("@/data/audit", () => ({
  emitAuditOnce: vi.fn(async () => undefined),
}))

vi.mock("./session", () => ({
  getIdentity: vi.fn(),
}))

vi.mock("./appliedFilter.server", () => ({
  serverMessagingFilterKeySelectOptions: [],
  serverProfileFilterKeySelectOptions: [],
}))

const { requestDataExportAction } = await import("./actions")

describe("requestDataExportAction", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns unauthorized and calls nothing when there is no session user", async () => {
    vi.mocked(getIdentity).mockResolvedValue(undefined)

    const result = await requestDataExportAction({ profileId: "profile-1" })

    expect(result.success).toBe(false)
    expect(ProfileDataService.requestDataExport).not.toHaveBeenCalled()
    expect(emitAuditOnce).not.toHaveBeenCalled()
  })

  it("passes the signed-in agent as the requester and audits the success", async () => {
    const user = {
      sub: "agent-1",
    } as Awaited<ReturnType<typeof getIdentity>>
    vi.mocked(getIdentity).mockResolvedValue(user)
    vi.mocked(ProfileDataService.requestDataExport).mockResolvedValue({
      success: true,
      value: undefined,
    })

    const result = await requestDataExportAction({ profileId: "profile-1" })

    expect(result.success).toBe(true)
    expect(ProfileDataService.requestDataExport).toHaveBeenCalledWith({
      profileId: "profile-1",
      requesterUserId: "agent-1",
    })
    expect(emitAuditOnce).toHaveBeenCalledWith(
      {
        actionName: "requestDataExport",
        actionType: "create",
        user,
        args: { profileId: "profile-1" },
      },
      undefined,
    )
  })

  it("threads the failure reason into the audit log when the data layer fails", async () => {
    const user = {
      sub: "agent-1",
    } as Awaited<ReturnType<typeof getIdentity>>
    vi.mocked(getIdentity).mockResolvedValue(user)
    vi.mocked(ProfileDataService.requestDataExport).mockResolvedValue({
      success: false,
      error: new Error("export already in progress"),
      userMessage: "export already in progress",
    })

    const result = await requestDataExportAction({ profileId: "profile-1" })

    expect(result.success).toBe(false)
    expect(emitAuditOnce).toHaveBeenCalledWith(
      {
        actionName: "requestDataExport",
        actionType: "create",
        user,
        args: { profileId: "profile-1" },
      },
      "export already in progress",
    )
  })
})
