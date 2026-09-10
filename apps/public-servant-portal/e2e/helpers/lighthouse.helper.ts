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

function getDebugPort(): number {
  return randomInt(49152, 65535)
}

export type LighthouseAuditOptions = {
  auditUrl: string
  reportName: string
  authenticate: (page: Page) => Promise<void>
}

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
