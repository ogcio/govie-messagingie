#!/usr/bin/env node

/**
 * Copies static and public files to the standalone folder
 * This is required for standalone mode to work correctly
 */

import { cpSync, existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const appDir = join(__dirname, "..")

const staticSource = join(appDir, ".next", "static")
const publicSource = join(appDir, "public")
const standaloneStaticDest = join(
  appDir,
  ".next",
  "standalone",
  "apps",
  "messaging-next",
  ".next",
  "static",
)
const standalonePublicDest = join(
  appDir,
  ".next",
  "standalone",
  "apps",
  "messaging-next",
  "public",
)

try {
  if (existsSync(staticSource)) {
    cpSync(staticSource, standaloneStaticDest, { recursive: true, force: true })
    console.log("✓ Copied static files to standalone folder")
  } else {
    console.warn("⚠ Static folder not found, skipping")
  }

  if (existsSync(publicSource)) {
    cpSync(publicSource, standalonePublicDest, { recursive: true, force: true })
    console.log("✓ Copied public files to standalone folder")
  } else {
    console.warn("⚠ Public folder not found, skipping")
  }
} catch (error) {
  console.error("Error copying standalone assets:", error)
  process.exit(1)
}
