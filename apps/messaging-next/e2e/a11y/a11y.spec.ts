import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"
import { createAuthenticatedPage } from "../helpers/user-auth.helper"

const citizenUrls = [
  "/en/messages",
  "/en/secure-messages/05bcc336-5b19-4717-9223-16a68fc08a2e",
]

test.describe("Accessibility (a11y) checks @regression", () => {
  for (const url of citizenUrls) {
    test(`citizen - should have no SERIOUS a11y violations on ${url}`, async ({
      browser,
      baseURL,
    }) => {
      const page = await createAuthenticatedPage(
        browser,
        "e2e_citizen_1@user.com",
      )
      await page.goto(baseURL + url, { waitUntil: "networkidle" })
      const accessibilityScanResults = await new AxeBuilder({ page })
        .exclude('iframe[title="reCAPTCHA"]')
        .analyze()
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
    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on dashboard`).toEqual([])
    await page.close()
  })

  test(`citizen - should have no SERIOUS a11y violations on dashboard`, async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(
      browser,
      "e2e_citizen_1@user.com",
    )
    await page.waitForLoadState("networkidle")

    await page.goto("https://dashboard.dev.services.gov.ie/en/my-dashboard", {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()
    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on dashboard`).toEqual([])
    await page.close()
  })

  test(`citizen - should have no SERIOUS a11y violations on profile`, async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(
      browser,
      "e2e_citizen_1@user.com",
    )
    await page.waitForLoadState("networkidle")

    await page.goto("https://profile.dev.services.gov.ie/en", {
      waitUntil: "networkidle",
    })
    const accessibilityScanResults = await new AxeBuilder({ page })
      .exclude('iframe[title="reCAPTCHA"]')
      .analyze()
    const seriousViolations = accessibilityScanResults.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    )
    expect(seriousViolations, `SERIOUS Violations on profile`).toEqual([])
    await page.close()
  })
})
