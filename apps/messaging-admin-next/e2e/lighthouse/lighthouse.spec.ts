import type { Page } from "@playwright/test"
import { test } from "@playwright/test"
import { authenticateUser } from "../helpers/auth"
import { runLighthouseAudit } from "../helpers/lighthouse.helper"

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"
const PROFILE_ADMIN_URL =
  process.env.PROFILE_ADMIN_URL || "http://localhost:3004"

type AuditCase = {
  title: string
  auditUrl: string
  reportName: string
  prepare?: (page: Page) => Promise<void>
}

const adminPathCases: AuditCase[] = [
  "/en/send-a-message",
  "/en/message-templates",
  "/en/message-templates/template",
  "/en/providers",
  "/en/providers/email",
  "/en/message-events",
  "/en/message-events/detail?eventId=4f765021-4760-4d1c-8f3e-c620c5cc407e",
].map((path) => ({
  title: path,
  auditUrl: `${ADMIN_URL}${path}`,
  reportName: `lighthouse${path.replace(/\//g, "-").split("?")[0]}`,
}))

const crossAppCases: AuditCase[] = [
  {
    title: "profile admin",
    auditUrl: `${PROFILE_ADMIN_URL}/en`,
    reportName: "lighthouse-profile-admin",
    prepare: async (page) => {
      await page.goto(`${PROFILE_ADMIN_URL}/en`, { waitUntil: "networkidle" })
    },
  },
  {
    title: "service users",
    auditUrl: `${PROFILE_ADMIN_URL}/en/service-users`,
    reportName: "lighthouse-service-users",
    prepare: async (page) => {
      await page.goto(`${PROFILE_ADMIN_URL}/en/service-users`, {
        waitUntil: "networkidle",
      })
    },
  },
]

test.describe("Lighthouse Audit @regression", () => {
  for (const auditCase of [...adminPathCases, ...crossAppCases]) {
    test(`admin - audit ${auditCase.title}`, async () => {
      await runLighthouseAudit({
        auditUrl: auditCase.auditUrl,
        reportName: auditCase.reportName,
        authenticate: async (page) => {
          await authenticateUser(page)
          await auditCase.prepare?.(page)
        },
      })
    })
  }
})
