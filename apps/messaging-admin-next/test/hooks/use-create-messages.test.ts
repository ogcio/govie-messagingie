import { renderHook } from "@testing-library/react"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const { ORGANIZATION_ID_HEADER, useSagClientMock, useOrganizationIdMock } =
  vi.hoisted(() => ({
    ORGANIZATION_ID_HEADER: "x-organization-id",
    useSagClientMock: vi.fn(),
    useOrganizationIdMock: vi.fn(),
  }))

vi.mock("@ogcio/sag-client", () => ({
  ORGANIZATION_ID_HEADER,
  SagFetchError: class FakeSagFetchError extends Error {
    status: number
    code?: string
    constructor(message: string, status: number, code?: string) {
      super(message)
      this.name = "SagFetchError"
      this.status = status
      this.code = code
    }
  },
}))

vi.mock("@ogcio/sag-client/react", () => ({
  useSagClient: () => useSagClientMock(),
}))

vi.mock("@/hooks/use-organization-id", () => ({
  useOrganizationId: () => useOrganizationIdMock(),
}))

beforeAll(() => {
  process.env.NEXT_PUBLIC_BASE_URL ??= "http://localhost:3022"
  process.env.NEXT_PUBLIC_SAG_URL ??= "http://localhost:3030"
})

// Note: keep imports below the mocks to ensure the mocked modules are wired
// before the hook resolves its dependencies.
import { useCreateMessages } from "@/hooks/use-create-messages"

type ClientStubOverrides = {
  fetch?: ReturnType<typeof vi.fn>
  mutate?: ReturnType<typeof vi.fn>
  appName?: string
  gatewayUrl?: string
}

function buildClientStub(overrides: ClientStubOverrides = {}) {
  return {
    appName: overrides.appName ?? "messaging-admin",
    gatewayUrl: overrides.gatewayUrl ?? "http://localhost:3030",
    fetch: overrides.fetch ?? vi.fn(),
    mutate: overrides.mutate ?? vi.fn(),
  }
}

function callHook(orgId: string | undefined = "org-1") {
  useOrganizationIdMock.mockReturnValue(orgId)
  const { result } = renderHook(() => useCreateMessages())
  return result.current
}

const TEMPLATE_CONTENT_EN = {
  language: "en",
  subject: "Hello {{publicName}}",
  plainText: "Hi {{publicName}}, your email is {{email}} (ppsn={{ppsn}}).",
  richText: "<p>Hi {{publicName}}</p>",
  templateName: "Welcome",
}

const TEMPLATE_CONTENT_GA = {
  language: "ga",
  subject: "Dia duit {{publicName}}",
  plainText: "Dia duit {{publicName}}",
  templateName: "Fáilte",
}

const PROFILE_ALICE = {
  id: "user-1",
  publicName: "Alice Wayne",
  email: "alice@example.com",
  preferredLanguage: "en",
  details: { ppsn: "1234567A" },
}

const PROFILE_BOB = {
  id: "user-2",
  publicName: "Bob Stark",
  email: "bob@example.com",
  preferredLanguage: "ga",
  details: { ppsn: "9999999X" },
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("useCreateMessages — short-circuit guards", () => {
  it.each([
    {
      label: "missing templateMetaId",
      payload: { userIds: ["user-1"], schedule: "2026-06-15T09:30:00Z" },
    },
    {
      label: "missing userIds",
      payload: {
        templateMetaId: "tpl-1",
        userIds: [],
        schedule: "2026-06-15T09:30:00Z",
      },
    },
    {
      label: "userIds contain only falsy entries",
      payload: {
        templateMetaId: "tpl-1",
        userIds: ["", undefined as unknown as string],
        schedule: "2026-06-15T09:30:00Z",
      },
    },
    {
      label: "missing schedule",
      payload: { templateMetaId: "tpl-1", userIds: ["user-1"] },
    },
  ])("returns { created: 0, errors: {} } when $label", async ({ payload }) => {
    const client = buildClientStub()
    useSagClientMock.mockReturnValue(client)

    const createMessages = callHook()
    const result = await createMessages(payload)

    expect(result).toEqual({ created: 0, errors: {} })
    expect(client.fetch).not.toHaveBeenCalled()
    expect(client.mutate).not.toHaveBeenCalled()
  })
})

describe("useCreateMessages — template fetch", () => {
  it("returns an api error when the template fetch throws", async () => {
    const client = buildClientStub({
      fetch: vi.fn().mockRejectedValueOnce(new Error("template down")),
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(0)
    expect(result.errors).toEqual({ api: "template down" })
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("returns 'Template not found' when contents are empty", async () => {
    const client = buildClientStub({
      fetch: vi.fn().mockResolvedValueOnce({ data: { contents: [] } }),
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(0)
    expect(result.errors).toEqual({ api: "Template not found" })
    expect(client.mutate).not.toHaveBeenCalled()
  })
})

describe("useCreateMessages — profile fetch", () => {
  it("returns an api error when the profile fetch throws", async () => {
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
        .mockRejectedValueOnce(new Error("profile service unreachable")),
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(0)
    expect(result.errors).toEqual({ api: "profile service unreachable" })
    expect(client.mutate).not.toHaveBeenCalled()
  })
})

describe("useCreateMessages — happy path", () => {
  it("creates one message per user with template interpolation and preferred language", async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { id: "ok" } })
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({
          data: { contents: [TEMPLATE_CONTENT_EN, TEMPLATE_CONTENT_GA] },
        })
        .mockResolvedValueOnce({ data: [PROFILE_ALICE, PROFILE_BOB] }),
      mutate,
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1", "user-2"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(2)
    expect(result.errors).toEqual({})
    expect(result.schedule).toBe("2026-06-15T09:30:00Z")
    expect(mutate).toHaveBeenCalledTimes(2)

    const [, , aliceBody, aliceOpts] = mutate.mock.calls[0]
    expect(aliceBody.recipientUserId).toBe("user-1")
    expect(aliceBody.message.subject).toBe("Hello Alice Wayne")
    expect(aliceBody.message.plainText).toBe(
      "Hi Alice Wayne, your email is alice@example.com (ppsn=1234567A).",
    )
    expect(aliceBody.message.language).toBe("en")
    expect(aliceBody.preferredTransports).toEqual(["email"])
    expect(aliceBody).not.toHaveProperty("attachments")
    expect(aliceOpts).toEqual({ organizationId: "org-1" })

    const [, , bobBody] = mutate.mock.calls[1]
    expect(bobBody.recipientUserId).toBe("user-2")
    expect(bobBody.message.language).toBe("ga")
    expect(bobBody.message.subject).toBe("Dia duit Bob Stark")
  })

  it("falls back to the first template language when preferredLanguage is unsupported", async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { id: "ok" } })
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
        .mockResolvedValueOnce({
          data: [{ ...PROFILE_BOB, preferredLanguage: "fr" }],
        }),
      mutate,
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-2"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(1)
    const [, , body] = mutate.mock.calls[0]
    expect(body.message.language).toBe("en")
    expect(body.message.subject).toBe("Hello Bob Stark")
  })

  it("records a per-user error when the profile is missing from the response", async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { id: "ok" } })
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
        .mockResolvedValueOnce({ data: [PROFILE_ALICE] }),
      mutate,
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1", "user-missing"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(1)
    expect(result.errors).toEqual({ "user-missing": "Profile not found" })
    expect(mutate).toHaveBeenCalledTimes(1)
  })

  it("records a per-user error when message creation throws", async () => {
    const mutate = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "ok" } })
      .mockRejectedValueOnce(new Error("send failed for bob"))
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({
          data: { contents: [TEMPLATE_CONTENT_EN, TEMPLATE_CONTENT_GA] },
        })
        .mockResolvedValueOnce({ data: [PROFILE_ALICE, PROFILE_BOB] }),
      mutate,
    })
    useSagClientMock.mockReturnValue(client)

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1", "user-2"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(1)
    expect(result.errors).toEqual({ "user-2": "send failed for bob" })
  })

  it("omits organizationId from mutate options when none is selected", async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { id: "ok" } })
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
        .mockResolvedValueOnce({ data: [PROFILE_ALICE] }),
      mutate,
    })
    useSagClientMock.mockReturnValue(client)

    useOrganizationIdMock.mockReturnValue(undefined)
    const createMessages = renderHook(() => useCreateMessages()).result.current

    const result = await createMessages({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
    })

    expect(result.created).toBe(1)
    const [, , , opts] = mutate.mock.calls[0]
    expect(opts).toBeUndefined()
    const [, fetchOpts] = client.fetch.mock.calls[0]
    expect(fetchOpts).toBeUndefined()
  })
})

describe("useCreateMessages — attachments flow", () => {
  it("uploads each pending file, shares it with recipients, and includes attachment ids in the message", async () => {
    const mutate = vi.fn().mockResolvedValue({ data: { id: "ok" } })
    const fetchClient = vi
      .fn()
      .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
      .mockResolvedValueOnce({ data: [PROFILE_ALICE] })
    const client = buildClientStub({ fetch: fetchClient, mutate })
    useSagClientMock.mockReturnValue(client)

    const globalFetch = vi.fn(async () =>
      new Response(JSON.stringify({ data: { id: "file-123" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", globalFetch)

    const file = new File(["hello"], "report.pdf", { type: "application/pdf" })
    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
      pendingFiles: [file],
    })

    expect(result.created).toBe(1)
    expect(globalFetch).toHaveBeenCalledTimes(1)
    const [uploadUrl, uploadInit] = globalFetch.mock.calls[0] as [
      string,
      RequestInit,
    ]
    expect(uploadUrl).toBe("http://localhost:3030/upload/api/v1/files")
    expect(uploadInit.method).toBe("POST")
    expect(uploadInit.credentials).toBe("include")
    expect(
      (uploadInit.headers as Record<string, string>)["X-Application"],
    ).toBe("messaging-admin")
    expect(
      (uploadInit.headers as Record<string, string>)[ORGANIZATION_ID_HEADER],
    ).toBe("org-1")

    const shareCall = mutate.mock.calls.find(([url]) =>
      url.includes("/permissions"),
    )
    expect(shareCall).toBeDefined()
    expect(shareCall?.[2]).toEqual({ fileId: "file-123", userIds: ["user-1"] })

    const sendCall = mutate.mock.calls.find(([url]) => url.endsWith("/messages"))
    expect(sendCall?.[2].attachments).toEqual(["file-123"])
  })

  it("returns 'Failed to upload files' when an upload responds non-ok", async () => {
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
        .mockResolvedValueOnce({ data: [PROFILE_ALICE] }),
    })
    useSagClientMock.mockReturnValue(client)

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: "scan rejected: virus" }), {
          status: 422,
          statusText: "Unprocessable Entity",
          headers: { "content-type": "application/json" },
        }),
      ),
    )

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
      pendingFiles: [new File(["x"], "bad.pdf")],
    })

    expect(result.created).toBe(0)
    expect(result.errors).toEqual({ api: "scan rejected: virus" })
    expect(client.mutate).not.toHaveBeenCalled()
  })

  it("returns 'Failed to share attachments' when the share-file mutation fails", async () => {
    const mutate = vi
      .fn()
      .mockRejectedValueOnce(new Error("share down"))
    const client = buildClientStub({
      fetch: vi
        .fn()
        .mockResolvedValueOnce({ data: { contents: [TEMPLATE_CONTENT_EN] } })
        .mockResolvedValueOnce({ data: [PROFILE_ALICE] }),
      mutate,
    })
    useSagClientMock.mockReturnValue(client)

    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ data: { id: "file-7" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    )

    const result = await callHook()({
      templateMetaId: "tpl-1",
      userIds: ["user-1"],
      schedule: "2026-06-15T09:30:00Z",
      pendingFiles: [new File(["x"], "report.pdf")],
    })

    expect(result.created).toBe(0)
    expect(result.errors).toEqual({ api: "share down" })
    // The send-message mutation must not run when sharing failed.
    expect(
      mutate.mock.calls.find(([url]) => url.endsWith("/messages")),
    ).toBeUndefined()
  })
})
