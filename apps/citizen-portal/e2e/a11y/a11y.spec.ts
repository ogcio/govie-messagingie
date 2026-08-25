import AxeBuilder from "@axe-core/playwright"
import { createHtmlReport } from "axe-html-reporter"
import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"
import fs from "fs"

const PROFILE_URL = process.env.PROFILE_URL || "http://localhost:3004"
const DASHBOARD_URL = process.env.DASHBOARD_URL || "http://localhost:3003"

/** Fixture from `e2e/user/user-messaging.spec.ts` (owned by peter.parker on dev). */
const SECURE_MESSAGE_ID = "becb3e86-6a5c-48e1-8bf7-c1cb884df69c"

const citizenPages = [
  { url: "/en/messages", citizen: "e2e_citizen_1@user.com" },
  {
    // Canonical `?id=` avoids the legacy path redirect in next.config.
    url: `/en/secure-messages?id=${SECURE_MESSAGE_ID}`,
    citizen: "peter.parker@mail.ie",
  },
]

test.describe("Accessibility (a11y) checks @regression", () => {
  for (const { url, citizen } of citizenPages) {
    test(`citizen - should have no SERIOUS a11y violations on ${url}`, async ({
      browser,
    }) => {
      const page = await createAuthenticatedPage(browser, citizen)
      await page.goto(url, { waitUntil: "networkidle" })
      const accessibilityScanResults = await new AxeBuilder({ page })
        .exclude('iframe[title="reCAPTCHA"]')
        .analyze()

      const pageName = url
        .replace(/\?.*$/, "")
        .replace(/\//g, "-")
        .replace(/-en-/g, "")

      const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "citizen-portal",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: `accessibility-report-${pageName}.html`,
        },
      })

      if (!fs.existsSync(`./e2e/test-results/a11y-report/accessibility-report-${pageName}.html`)) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
        })
    } 
    fs.writeFileSync(`./e2e/test-results/a11y-report/accessibility-report-${pageName}.html`, reportHTML)

    const seriousViolations = accessibilityScanResults.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      )
      expect(seriousViolations, `SERIOUS Violations on ${url}`).toEqual([])
      await page.close()
    })
  }
  
  test(`citizen - should have no SERIOUS a11y violations on consent`, async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "")
    await page.waitForLoadState("networkidle")
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()

    const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "citizen-portal",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: "accessibility-report-consent.html",
      },
    })

    if (!fs.existsSync("./e2e/test-results/a11y-report/accessibility-report-consent.html")) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
      })
    }
    fs.writeFileSync("./e2e/test-results/a11y-report/accessibility-report-consent.html", reportHTML)

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on consent`).toEqual([])
    await page.close()
  })

  test(`citizen - should have no SERIOUS a11y violations on dashboard`, async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(
      browser,
      "e2e_citizen_1@user.com",
    )
    //await page.waitForLoadState("networkidle")

    await page.goto(`${DASHBOARD_URL}/en/my-dashboard`, {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()

    const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "citizen-portal",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: "accessibility-report-dashboard.html",
      },
    })

    if (!fs.existsSync("./e2e/test-results/a11y-report/accessibility-report-dashboard.html")) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
      })
    }
    fs.writeFileSync("./e2e/test-results/a11y-report/accessibility-report-dashboard.html", reportHTML)

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on dashboard`).toEqual([])
    await page.close()
  })

  test(`citizen - should have no SERIOUS a11y violations on submissions`, async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(
      browser,
      "e2e_citizen_1@user.com",
    )
    //await page.waitForLoadState("networkidle")

    await page.goto(`${DASHBOARD_URL}/en/my-submissions`, {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()

    const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "citizen-portal",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: "accessibility-report-submissions.html",
      },
    })

    if (!fs.existsSync("./e2e/test-results/a11y-report/accessibility-report-submissions.html")) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
      })
    }
    fs.writeFileSync("./e2e/test-results/a11y-report/accessibility-report-submissions.html", reportHTML)

    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on submissions`).toEqual([])
    await page.close()
  })

  test(`citizen - should have no SERIOUS a11y violations on profile`, async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(
      browser,
      "e2e_citizen_1@user.com",
    )
    //await page.waitForLoadState("networkidle")

    await page.goto(`${PROFILE_URL}/en`, {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()
    
    const reportHTML = createHtmlReport({
      results: accessibilityScanResults,
      options: {
        projectKey: "citizen-portal",
        outputDir: "./e2e/test-results/a11y-report",
        reportFileName: "accessibility-report-profile.html",
      },
    })

    if (!fs.existsSync("./e2e/test-results/a11y-report/accessibility-report-profile.html")) {
      fs.mkdirSync("./e2e/test-results/a11y-report", {
        recursive: true,
      })
    }
    fs.writeFileSync("./e2e/test-results/a11y-report/accessibility-report-profile.html", reportHTML)
    
    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on profile`).toEqual([])
    await page.close()
  })
})
