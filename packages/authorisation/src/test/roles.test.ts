import type { IdTokenClaims } from "@logto/next"
import { describe, expect, it } from "vitest"
import {
  INACTIVE_PUBLIC_SERVANT_ORG_ROLE,
  ROLE_NAME_CITIZEN,
  ROLE_NAME_ONBOARDED_CITIZEN,
} from "../constants"
import {
  isCitizen,
  isCitizenOnboarded,
  isInactivePublicServant,
  isPublicServant,
} from "../roles"

describe("roles utils", () => {
  it("detects inactive public servant", () => {
    expect(isInactivePublicServant([INACTIVE_PUBLIC_SERVANT_ORG_ROLE])).toBe(
      true,
    )
  })

  it("detects public servant (active)", () => {
    expect(
      isPublicServant(["org:Public Servant"], ["Public Servant", "Manager"]),
    ).toBe(true)
  })

  it("isCitizen: true for pre-onboarding citizen role", () => {
    expect(isCitizen({ roles: [ROLE_NAME_CITIZEN] } as IdTokenClaims)).toBe(
      true,
    )
  })

  it("isCitizen: true for onboarded citizen role", () => {
    expect(
      isCitizen({ roles: [ROLE_NAME_ONBOARDED_CITIZEN] } as IdTokenClaims),
    ).toBe(true)
  })

  it("isCitizen: false for public servant (no citizen role)", () => {
    expect(
      isCitizen({ roles: ["Messaging Public Servant"] } as IdTokenClaims),
    ).toBe(false)
  })

  it("isCitizen: false for empty roles", () => {
    expect(isCitizen({ roles: [] } as IdTokenClaims)).toBe(false)
  })

  it("isCitizen: false for undefined", () => {
    expect(isCitizen(undefined)).toBe(false)
  })

  it("isCitizenOnboarded matches role", () => {
    expect(
      isCitizenOnboarded({
        roles: [ROLE_NAME_ONBOARDED_CITIZEN],
      } as IdTokenClaims),
    ).toBe(true)
    expect(isCitizenOnboarded({ roles: ["Other"] } as IdTokenClaims)).toBe(
      false,
    )
  })
})
