import type { Page } from "@playwright/test"

const DEMO_AUTH_STATUS = {
  authenticated: true,
  app: "messaging",
  user: {
    sub: "932d94fc69be147f6fcb",
    email: "peter.parker@mail.ie",
    name: "Andrew Parker",
  },
  claims: {
    roles: ["Onboarded citizen", "citizen"],
    organizations: [],
    organization_roles: [],
    signinMethod: "social:mygovid",
  },
}

/**
 * Bypasses the local Logto/SAG chain for demo recordings against
 * `next dev` (:4001).
 */
export async function stubAuthForDemo(page: Page) {
  await page.route(/sag\.local\.test/, async (route) => {
    const url = route.request().url()

    if (url.includes("/auth/status")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(DEMO_AUTH_STATUS),
      })
      return
    }

    if (url.includes("/auth/health")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ status: "healthy" }),
      })
      return
    }

    if (url.includes("/auth/organizations")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      })
      return
    }

    if (url.includes("/consent")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { accepted: true } }),
      })
      return
    }

    if (url.includes("/announcements")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: [] }),
      })
      return
    }

    if (url.includes("/profiles/")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { publicName: "Mark Murphy" } }),
      })
      return
    }

    if (url.includes("/auth/sign-in")) {
      await route.abort()
      return
    }

    await route.continue()
  })

  await page.route(/localhost:4242\/api\/frontend/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ toggles: [] }),
    })
  })
}
