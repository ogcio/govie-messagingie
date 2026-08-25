import type { Page } from "@playwright/test"
import { test } from "@playwright/test"
import { runLighthouseAudit } from "../helpers/lighthouse.helper"
import { loginAsCitizen } from "../helpers/user-auth.helper"

const BASE_URL = process.env.BASE_URL || "http://localhost:3001"
const PROFILE_URL = process.env.PROFILE_URL || "http://localhost:3004"
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3003"

const CITIZEN = "e2e_citizen_1@user.com"

/** Fixture from `e2e/user/user-messaging.spec.ts` (owned by peter.parker on dev). */
const SECURE_MESSAGE_ID = "becb3e86-6a5c-48e1-8bf7-c1cb884df69c"

type AuditCase = {
  title: string
  auditUrl: string
  reportName: string
  citizen: string
  /** Warm cookies / wait for UI before Lighthouse opens the URL. */
  prepare?: (page: Page) => Promise<void>
}

const auditCases: AuditCase[] = [
  {
    title: "messages",
    auditUrl: `${BASE_URL}/en/messages`,
    reportName: "lighthouse-en-messages",
    citizen: CITIZEN,
  },
  {
    title: "secure message detail",
    // Canonical `?id=` avoids the legacy path redirect in next.config.
    auditUrl: `${BASE_URL}/en/secure-messages?id=${SECURE_MESSAGE_ID}`,
    reportName: "lighthouse-en-secure-messages",
    citizen: "peter.parker@mail.ie",
  },
  {
    title: "consent",
    auditUrl: BASE_URL,
    reportName: "lighthouse-consent",
    citizen: "",
    prepare: async (page) => {
      await page.goto(BASE_URL, { waitUntil: "networkidle" })
    },
  },
  {
    title: "dashboard",
    auditUrl: `${DASHBOARD_URL}/en/my-dashboard`,
    reportName: "lighthouse-dashboard",
    citizen: CITIZEN,
    prepare: async (page) => {
      await page.goto(`${DASHBOARD_URL}/en/my-dashboard`, {
        waitUntil: "networkidle",
      })
    },
  },
  {
    title: "submissions",
    auditUrl: `${DASHBOARD_URL}/en/my-submissions`,
    reportName: "lighthouse-submissions",
    citizen: CITIZEN,
    prepare: async (page) => {
      await page.goto(`${DASHBOARD_URL}/en/my-submissions`, {
        waitUntil: "networkidle",
      })
    },
  },
  {
    title: "profile",
    auditUrl: `${PROFILE_URL}/en/my-profile`,
    reportName: "lighthouse-profile",
    citizen: CITIZEN,
    prepare: async (page) => {
      await page.goto(`${PROFILE_URL}/en/my-profile`, {
        waitUntil: "networkidle",
      })
      await page.waitForSelector('[data-testid="public-name-input"]')
    },
  },
]

test.describe("Lighthouse Audit @regression", () => {
  for (const auditCase of auditCases) {
    test(`citizen - audit ${auditCase.title}`, async () => {
      await runLighthouseAudit({
        auditUrl: auditCase.auditUrl,
        reportName: auditCase.reportName,
        authenticate: async (page) => {
          await loginAsCitizen(page, auditCase.citizen)
          await auditCase.prepare?.(page)
        },
      })
    })
  }
})
