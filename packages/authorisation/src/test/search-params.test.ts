import { describe, expect, it } from "vitest"
import { POST_LOGIN_SEARCH_PARAMS } from "../constants"
import { buildPreLoginSearch, parsePreLoginParams } from "../search-params"

describe("search-params", () => {
  it("parses preLogin params", () => {
    const sp = new URLSearchParams(
      `${POST_LOGIN_SEARCH_PARAMS.LoginUrl}=%2Fapi%2Fafter-login&${POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath}=%2Fhome`,
    )
    const parsed = parsePreLoginParams(sp)
    expect(parsed.loginUrl).toBe("/api/after-login")
    expect(parsed.postLoginRedirectPath).toBe("/home")
  })

  it("builds preLogin search string only with provided values", () => {
    const q1 = buildPreLoginSearch({
      loginUrl: "/api/after-login",
      postLoginRedirectPath: "/home",
    })
    expect(q1).toBe(
      `${POST_LOGIN_SEARCH_PARAMS.LoginUrl}=%2Fapi%2Fafter-login&${POST_LOGIN_SEARCH_PARAMS.PostLoginRedirectPath}=%2Fhome`,
    )

    const q2 = buildPreLoginSearch({ loginUrl: "/api/after-login" })
    expect(q2).toBe(`${POST_LOGIN_SEARCH_PARAMS.LoginUrl}=%2Fapi%2Fafter-login`)
  })
})
