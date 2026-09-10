import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionUser } from "./types"

vi.mock("@/utils/env", () => ({
  getEnvConfig: () => ({ AUDIT_API_URL: "https://audit.test" }),
}))

const sendLogs = vi.fn()
vi.mock("./sdk", () => ({
  getSupportSdk: () => ({
    auditCollector: { sendLogs: (...args: unknown[]) => sendLogs(...args) },
  }),
}))

// react.cache memoizes per module instance; fresh imports isolate the ledger.
async function freshAudit() {
  vi.resetModules()
  return import("./audit")
}

const user: SessionUser = { name: "Agent", email: "agent@gov.ie" }

beforeEach(() => {
  sendLogs.mockReset()
})

describe("emitAuditOnce", () => {
  it("sends one audit entry through the sdk", async () => {
    sendLogs.mockResolvedValue({ data: [{ id: "log-1" }] })
    const { emitAuditOnce } = await freshAudit()

    await emitAuditOnce({
      user,
      actionName: "testAction",
      actionType: "read",
      args: { profileId: "p-1" },
    })
    // sendLogs is fired without awaiting; flush microtasks
    await new Promise((r) => setImmediate(r))

    expect(sendLogs).toHaveBeenCalledTimes(1)
    const [logs] = sendLogs.mock.calls[0]
    expect(logs).toHaveLength(1)
    expect(logs[0].application_id).toBe("messaging-support")
    expect(logs[0].successful).toBe(true)
    expect(logs[0].user_email_address).toBe("agent@gov.ie")
    expect(logs[0].metadata.actionName).toBe("testAction")
  })

  it("marks the entry failed and records the reason", async () => {
    sendLogs.mockResolvedValue({ data: [{ id: "log-1" }] })
    const { emitAuditOnce } = await freshAudit()

    await emitAuditOnce(
      {
        user,
        actionName: "testAction",
        actionType: "update",
        args: {},
      },
      "it broke",
    )
    await new Promise((r) => setImmediate(r))

    const [logs] = sendLogs.mock.calls[0]
    expect(logs[0].successful).toBe(false)
    expect(logs[0].failure_reason).toBe("it broke")
  })

  // Note: the once-per-request dedup rides on react's cache(), which is a
  // passthrough in the client React build vitest/jsdom loads — it can only
  // be observed on the server runtime, so it is not asserted here.

  it("does not throw when the sdk call rejects", async () => {
    sendLogs.mockRejectedValue(new Error("network down"))
    const { emitAuditOnce } = await freshAudit()

    await expect(
      emitAuditOnce({
        user,
        actionName: "testAction",
        actionType: "read",
        args: {},
      }),
    ).resolves.toBeUndefined()
    await new Promise((r) => setImmediate(r))

    expect(sendLogs).toHaveBeenCalledTimes(1)
  })
})
