import { describe, expect, it } from "vitest"
import {
  getProfileImportErrorDetail,
  getProfileImportIdFromResponse,
} from "./profile-import-response"

describe("profile import response helpers", () => {
  it("reads profileImportId from the gateway response shape", () => {
    expect(
      getProfileImportIdFromResponse({
        status: "pending",
        profileImportId: "import-123",
      }),
    ).toBe("import-123")
  })

  it("reads profileImportId from wrapped SDK-style responses", () => {
    expect(
      getProfileImportIdFromResponse({
        data: { status: "pending", profileImportId: "import-456" },
      }),
    ).toBe("import-456")
  })

  it("returns API error detail when present", () => {
    expect(
      getProfileImportErrorDetail(
        { error: { detail: "Invalid CSV format" } },
        "fallback",
      ),
    ).toBe("Invalid CSV format")
  })
})
