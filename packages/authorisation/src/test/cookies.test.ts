import { beforeEach, describe, expect, it, vi } from "vitest"

type CookieRecord = { value: string; opts?: Record<string, unknown> }
const store = new Map<string, CookieRecord>()

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: (name: string, value: string, opts?: Record<string, unknown>) =>
      store.set(name, { value, opts }),
    get: (name: string) => store.get(name),
    delete: (nameOrObj: string | { name: string }) => {
      const key = typeof nameOrObj === "string" ? nameOrObj : nameOrObj.name
      store.delete(key)
    },
    getAll: () =>
      Array.from(store.keys()).map((k) => ({
        name: k,
        value: store.get(k)?.value,
      })),
  }),
}))

import {
  CONNECTOR_ENTRAID,
  CONNECTOR_MYGOVID,
  LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME,
  LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME,
} from "../constants"
import {
  createConsumePostLoginRedirectCookie,
  createDeleteAllCookies,
  createDeleteLogtoCookies,
  createSetPostLoginRedirectCookie,
  createSetSocialConnectorCookie,
} from "../cookies"
import type { AppConfig } from "../types"

const mockConfig: AppConfig = {
  messagingApiResource: "https://api.example.com/messaging",
  profileApiResource: "https://api.example.com/profile",
  uploadApiResource: "https://api.example.com/upload",
  baseUrl: "http://localhost:3000",
  appId: "test-app-id",
  appSecret: "test-app-secret",
  logtoCookieSecret: "test-secret",
  logtoEndpoint: "https://logto.example.com",
  isProductionEnv: false,
  profileUrl: "https://profile.example.com",
  publicServantRedirectUrl: "https://admin.example.com",
  myGovIdEndSessionUrl: "https://idp.example.com/logout",
  cookieDomain: undefined,
}

describe("cookies utils", () => {
  beforeEach(() => {
    store.clear()
  })

  it("sets social connector cookie with default mygovid", () => {
    const setSocialConnectorCookie = createSetSocialConnectorCookie(mockConfig)
    setSocialConnectorCookie()
    expect(store.get(LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME)?.value).toBe(
      CONNECTOR_MYGOVID,
    )
  })

  it("sets social connector cookie with custom connector ID", () => {
    const setSocialConnectorCookie = createSetSocialConnectorCookie(mockConfig)
    setSocialConnectorCookie(CONNECTOR_ENTRAID)
    expect(store.get(LOGTO_SOCIAL_CONNECTOR_ID_COOKIE_NAME)?.value).toBe(
      CONNECTOR_ENTRAID,
    )
  })

  it("sets and consumes post login redirect cookie", () => {
    const setPostLoginRedirectCookie =
      createSetPostLoginRedirectCookie(mockConfig)
    const consumePostLoginRedirectCookie =
      createConsumePostLoginRedirectCookie(mockConfig)
    setPostLoginRedirectCookie("/home")
    expect(store.get(LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME)?.value).toBe(
      "/home",
    )
    const value = consumePostLoginRedirectCookie()
    expect(value).toBe("/home")
    expect(store.has(LOGTO_POST_LOGIN_REDIRECT_URL_COOKIE_NAME)).toBe(false)
  })

  it("deleteLogtoCookies deletes only logto:* cookies", () => {
    const deleteLogtoCookies = createDeleteLogtoCookies(mockConfig)
    store.set("logto:a", { value: "1" })
    store.set("b", { value: "2" })
    deleteLogtoCookies()
    expect(store.has("logto:a")).toBe(false)
    expect(store.has("b")).toBe(true)
  })

  it("deleteAllCookies deletes everything", () => {
    const deleteAllCookies = createDeleteAllCookies(mockConfig)
    store.set("x", { value: "1" })
    store.set("y", { value: "2" })
    deleteAllCookies()
    expect(store.size).toBe(0)
  })
})
