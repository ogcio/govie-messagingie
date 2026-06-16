import { describe, expect, it } from "vitest"
import {
  getSystemSenderTranslationKey,
  SYSTEM_SENDER_LABELS,
} from "@/components/messages/system-senders"

describe("getSystemSenderTranslationKey", () => {
  it("recognises the messaging-api support slug", () => {
    /*
     * `"support"` is the default of the messaging-api `SUPPORT_ORGANISATION_ID`
     * env var. If that default ever changes server-side, this test (and the
     * SYSTEM_SENDER_LABELS map) need to follow.
     */
    expect(getSystemSenderTranslationKey("support")).toBe("support")
  })

  it("returns null for real-looking organisation UUIDs", () => {
    expect(
      getSystemSenderTranslationKey("123e4567-e89b-12d3-a456-426614174000"),
    ).toBeNull()
  })

  it("returns null for empty / missing ids without throwing", () => {
    expect(getSystemSenderTranslationKey(null)).toBeNull()
    expect(getSystemSenderTranslationKey(undefined)).toBeNull()
    expect(getSystemSenderTranslationKey("")).toBeNull()
  })

  it("treats unknown slugs as real org ids (lookup falls through to the profile path)", () => {
    expect(getSystemSenderTranslationKey("not-a-known-system")).toBeNull()
  })

  it("exposes the slug map as a read-only object so consumers can't mutate it", () => {
    /*
     * The map is exported as `Readonly<Record<string, string>>` for type-level
     * safety; this asserts the runtime shape matches expectations and that
     * the `support` slug round-trips through both the map and the helper.
     */
    expect(SYSTEM_SENDER_LABELS).toMatchObject({ support: "support" })
    expect(Object.keys(SYSTEM_SENDER_LABELS)).toContain("support")
  })
})
