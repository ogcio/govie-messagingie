import { randomInt } from "node:crypto"
import os from "node:os"
import path from "node:path"
import type { Page } from "@playwright/test"
import { type BrowserContext, chromium } from "playwright"
import { playAudit } from "playwright-lighthouse"

const THRESHOLDS = {
  performance: 50,
  accessibility: 100,
  "best-practices": 90,
  seo: 90,
} as const

const REPORT_DIR = "./e2e/test-results/lighthouse-report"

/**
 * Chromium remote-debugging port in the IANA ephemeral range.
 * Serial e2e (`--workers 1`) makes collisions unlikely; Chromium fails
 * loudly if the port is taken so the test retries via Playwright.
 */
function getDebugPort(): number {
  return randomInt(49152, 65535)
}

export type LighthouseAuditOptions = {
  /** Absolute URL Lighthouse will open (session comes from the persistent context). */
  auditUrl: string
  /** Report filename stem, e.g. `lighthouse-send-a-message`. */
  reportName: string
  /** Log in (and optionally warm the target page) before the audit. */
  authenticate: (page: Page) => Promise<void>
}

/**
 * Launch a persistent Chromium context, authenticate, run playAudit, then close.
 * Persistent context is required so the Lighthouse-opened tab reuses the session.
 */
export async function runLighthouseAudit({
  auditUrl,
  reportName,
  authenticate,
}: LighthouseAuditOptions): Promise<void> {
  const port = getDebugPort()
  const userDataDir = path.join(os.tmpdir(), "pw-lighthouse", String(port))
  let context: BrowserContext | undefined

  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      args: [`--remote-debugging-port=${port}`],
    })
    const page = await context.newPage()
    await authenticate(page)

    await playAudit({
      url: auditUrl,
      thresholds: THRESHOLDS,
      port,
      reports: {
        formats: { json: true, html: true, csv: true },
        name: reportName,
        directory: REPORT_DIR,
      },
    })
  } finally {
    await context?.close()
  }
}
