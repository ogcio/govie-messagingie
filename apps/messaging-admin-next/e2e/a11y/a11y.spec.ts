import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { createHtmlReport } from "axe-html-reporter"
import fs from "fs"
import { authenticateUser } from "../helpers/auth"

const ADMIN_URL = process.env.ADMIN_URL || "http://localhost:3001"
const PROFILE_ADMIN_URL =
  process.env.PROFILE_ADMIN_URL || "http://localhost:3004"

const adminUrls = [
  "/en/send-a-message",
  "/en/message-templates",
  "/en/message-templates/template",
  "/en/providers",
  "/en/providers/email",
  "/en/message-events",
  "/en/message-events/detail?eventId=4f765021-4760-4d1c-8f3e-c620c5cc407e",
]

test.describe("Accessibility (a11y) checks @regression", () => {
  for (const url of adminUrls) {
    test(`admin - should have no SERIOUS a11y violations on ${url}`, async ({
      page,
    }) => {
      await authenticateUser(page)
      await page.goto(ADMIN_URL + url, { waitUntil: "networkidle" })
      const accessibilityScanResults = await new AxeBuilder({ page })
        .exclude('iframe[title="reCAPTCHA"]')
        .analyze()

      const pageName = url.replace(/\//g, "-").replace(/-en-/g, "")

      const reportHTML = createHtmlReport({
        results: accessibilityScanResults,
        options: {
          projectKey: "messaging-admin",
          outputDir: "./e2e/test-results/a11y-report",
          reportFileName: `accessibility-report-${pageName}.html`,
        },
      })

      if (
        !fs.existsSync(
          `./e2e/test-results/a11y-report/accessibility-report-${pageName}.html`,
        )
      ) {
        fs.mkdirSync("./e2e/test-results/a11y-report", {
          recursive: true,
        })
      }
      fs.writeFileSync(
        `./e2e/test-results/a11y-report/accessibility-report-${pageName}.html`,
        reportHTML,
      )

      const seriousViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      )
      expect(seriousViolations, `SERIOUS Violations on ${url}`).toEqual([])
    })
  }
  test(`admin - should have no SERIOUS a11y violations on profile`, async ({
    page,
  }) => {
    await authenticateUser(page)
    await page.goto(`${PROFILE_ADMIN_URL}/en`, {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()

    const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "messaging-admin",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: "accessibility-report-profile-admin.html",
      },
    })

    if (
      !fs.existsSync(
        "./e2e/test-results/a11y-report/accessibility-report-profile-admin.html",
      )
    ) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
      })
    }
    fs.writeFileSync(
      "./e2e/test-results/a11y-report/accessibility-report-profile-admin.html",
      reportHTML,
    )

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on profile-admin`).toEqual([])
    await page.close()
  })

  test(`admin - should have no SERIOUS a11y violations on service users`, async ({
    page,
  }) => {
    await authenticateUser(page)
    await page.goto(`${PROFILE_ADMIN_URL}/en/service-users`, {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()
    const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "messaging-admin",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: "accessibility-report-service-users-admin.html",
      },
    })

    if (
      !fs.existsSync(
        "./e2e/test-results/a11y-report/accessibility-report-service-users-admin.html",
      )
    ) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
      })
    }
    fs.writeFileSync(
      "./e2e/test-results/a11y-report/accessibility-report-service-users-admin.html",
      reportHTML,
    )

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(
      seriousViolations,
      `SERIOUS Violations on service-users-admin`,
    ).toEqual([])
    await page.close()
  })
})
