#!/usr/bin/env node

/**
 * Build script that uses tsconfig.prod.json for production builds
 * Merges the exclude patterns from tsconfig.prod.json into tsconfig.json
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const appDir = join(__dirname, "..")

const tsconfigPath = join(appDir, "tsconfig.json")
const tsconfigProdPath = join(appDir, "tsconfig.prod.json")
const tsconfigBackupPath = join(appDir, "tsconfig.json.backup")

try {
  // Check if tsconfig.prod.json exists
  if (!existsSync(tsconfigProdPath)) {
    console.error("Error: tsconfig.prod.json not found")
    process.exit(1)
  }

  // Read both configs
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"))
  const tsconfigProd = JSON.parse(readFileSync(tsconfigProdPath, "utf-8"))

  // Backup original tsconfig.json
  writeFileSync(tsconfigBackupPath, JSON.stringify(tsconfig, null, 2))

  // Merge exclude arrays from tsconfig.prod.json
  if (tsconfigProd.exclude) {
    tsconfig.exclude = tsconfigProd.exclude
  }

  // Write updated tsconfig.json
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2))

  console.log("✓ Updated tsconfig.json with production excludes")

  // Run the build
  const { execSync } = await import("node:child_process")
  execSync("next build", {
    stdio: "inherit",
    cwd: appDir,
  })

  // Copy static and public files to standalone folder (required for standalone mode)
  const copyScript = join(__dirname, "copy-standalone-assets.mjs")
  execSync(`node ${copyScript}`, {
    stdio: "inherit",
    cwd: appDir,
  })
} catch (error) {
  console.error("Build failed:", error)
  process.exit(1)
} finally {
  // Restore original tsconfig.json from backup
  if (existsSync(tsconfigBackupPath)) {
    const original = readFileSync(tsconfigBackupPath, "utf-8")
    writeFileSync(tsconfigPath, original)
    // Remove backup file
    const { unlinkSync } = await import("node:fs")
    unlinkSync(tsconfigBackupPath)
    console.log("✓ Restored original tsconfig.json")
  }
}
