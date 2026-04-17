import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * Enhanced Environment File Initialization Script
 *
 * This script intelligently syncs .env files with their .env.sample counterparts:
 * 1. Adds missing keys from .env.sample to .env
 * 2. Removes keys that are no longer in .env.sample from .env
 * 3. Preserves existing values in .env
 * 4. Handles comments and empty lines properly
 * 5. Supports both create and update modes
 */

class EnvInitializer {
  constructor() {
    this.rootDir = path.join(__dirname, "..")
    this.updateMode = process.env.MODE === "update"
    this.forceMode = process.argv.includes("--force")
    this.dryRun = process.argv.includes("--dry-run")
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString()
    const prefix = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    }[type]

    console.log(`${prefix} [${timestamp}] ${message}`)
  }

  /**
   * Parse .env file content into a map of key-value pairs
   */
  parseEnvFile(content) {
    const envMap = new Map()
    const lines = content.split("\n")

    for (const line of lines) {
      const trimmedLine = line.trim()

      // Skip comments and empty lines
      if (trimmedLine.startsWith("#") || trimmedLine === "") {
        continue
      }

      // Parse key=value pairs
      const equalIndex = trimmedLine.indexOf("=")
      if (equalIndex > 0) {
        const key = trimmedLine.substring(0, equalIndex)
        const value = trimmedLine.substring(equalIndex + 1)
        envMap.set(key, value)
      }
    }

    return envMap
  }

  /**
   * Parse .env file content preserving comments and structure
   */
  parseEnvFileWithComments(content) {
    const lines = content.split("\n")
    const result = {
      comments: [],
      variables: new Map(),
      structure: [],
    }

    for (const line of lines) {
      const trimmedLine = line.trim()

      if (trimmedLine.startsWith("#")) {
        result.comments.push(line)
        result.structure.push({ type: "comment", content: line })
      } else if (trimmedLine === "") {
        result.structure.push({ type: "empty", content: line })
      } else {
        const equalIndex = trimmedLine.indexOf("=")
        if (equalIndex > 0) {
          const key = trimmedLine.substring(0, equalIndex)
          const value = trimmedLine.substring(equalIndex + 1)
          result.variables.set(key, value)
          result.structure.push({
            type: "variable",
            key,
            value,
            originalLine: line,
          })
        } else {
          result.structure.push({ type: "other", content: line })
        }
      }
    }

    return result
  }

  /**
   * Generate .env content from sample with existing values preserved
   */
  generateEnvContent(sampleContent, existingEnvMap = new Map()) {
    const sampleParsed = this.parseEnvFileWithComments(sampleContent)
    const lines = []

    for (const item of sampleParsed.structure) {
      if (item.type === "comment" || item.type === "empty") {
        lines.push(item.content)
      } else if (item.type === "variable") {
        const existingValue = existingEnvMap.get(item.key)
        if (existingValue !== undefined) {
          // Preserve existing value
          lines.push(`${item.key}=${existingValue}`)
        } else {
          // Use sample value
          lines.push(`${item.key}=${item.value}`)
        }
      } else {
        lines.push(item.content)
      }
    }

    return lines.join("\n")
  }

  /**
   * Sync .env file with .env.sample
   */
  syncEnvFile(envPath, samplePath) {
    try {
      // Read .env.sample
      if (!fs.existsSync(samplePath)) {
        this.log(`No .env.sample found at ${samplePath}`, "warning")
        return false
      }

      const sampleContent = fs.readFileSync(samplePath, "utf8")
      const sampleKeys = this.parseEnvFile(sampleContent)

      // Read existing .env if it exists
      let existingEnvMap = new Map()
      let existingContent = ""
      if (fs.existsSync(envPath)) {
        existingContent = fs.readFileSync(envPath, "utf8")
        existingEnvMap = this.parseEnvFile(existingContent)
      }

      // Check for missing keys in .env
      const missingKeys = []
      for (const [key] of sampleKeys) {
        if (!existingEnvMap.has(key)) {
          missingKeys.push(key)
        }
      }

      // Check for obsolete keys in .env
      const obsoleteKeys = []
      for (const [key] of existingEnvMap) {
        if (!sampleKeys.has(key)) {
          obsoleteKeys.push(key)
        }
      }

      // Report changes
      if (missingKeys.length > 0) {
        this.log(
          `Missing keys in ${path.relative(this.rootDir, envPath)}: ${missingKeys.join(", ")}`,
          "info",
        )
      }

      if (obsoleteKeys.length > 0) {
        this.log(
          `Obsolete keys in ${path.relative(this.rootDir, envPath)}: ${obsoleteKeys.join(", ")}`,
          "warning",
        )
      }

      if (missingKeys.length === 0 && obsoleteKeys.length === 0) {
        this.log(
          `${path.relative(this.rootDir, envPath)} is up to date`,
          "success",
        )
        return true
      }

      // Generate new content
      const newContent = this.generateEnvContent(sampleContent, existingEnvMap)

      if (this.dryRun) {
        this.log(
          `[DRY RUN] Would update ${path.relative(this.rootDir, envPath)}`,
          "info",
        )
        return true
      }

      // Write the file
      fs.writeFileSync(envPath, newContent)

      const action = fs.existsSync(envPath) ? "updated" : "created"
      this.log(
        `.env file ${action} at ${path.relative(this.rootDir, envPath)}`,
        "success",
      )

      return true
    } catch (error) {
      this.log(
        `Failed to sync ${path.relative(this.rootDir, envPath)}: ${error.message}`,
        "error",
      )
      return false
    }
  }

  /**
   * Process all .env files in the project
   */
  async run() {
    this.log("🔧 Starting environment file initialization...", "info")

    if (this.dryRun) {
      this.log("Running in dry-run mode - no files will be modified", "warning")
    }

    // Get all paths to check
    const paths = [
      this.rootDir,
      ...fs
        .readdirSync(path.join(this.rootDir, "apps"))
        .map((p) => path.join(this.rootDir, "apps", p)),
    ]

    let successCount = 0
    let totalCount = 0
    let skippedCount = 0

    for (const currentPath of paths) {
      const samplePath = path.join(currentPath, ".env.sample")
      const envPath = path.join(currentPath, ".env")

      if (fs.existsSync(samplePath)) {
        totalCount++

        // Check if .env exists and we're not in update mode
        if (!this.updateMode && fs.existsSync(envPath)) {
          this.log(
            `${path.relative(this.rootDir, envPath)} already exists, skipping...`,
            "info",
          )
          skippedCount++
          continue
        }

        if (this.syncEnvFile(envPath, samplePath)) {
          successCount++
        }
      }
    }

    this.log(
      `🎉 Environment initialization completed: ${successCount}/${totalCount} files processed (${skippedCount} skipped)`,
      "success",
    )

    // Only exit with error if there were actual failures (not just skipped files)
    if (successCount < totalCount - skippedCount) {
      process.exit(1)
    }
  }
}

// Run the initializer
const initializer = new EnvInitializer()
try {
  await initializer.run()
} catch (error) {
  console.error("Environment initialization failed:", error)
  process.exit(1)
}
