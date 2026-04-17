import { execSync } from "node:child_process"
import crypto from "node:crypto"
import fs from "node:fs"
import http from "node:http"
import https from "node:https"
import os from "node:os"
import path, { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Development Environment Health Check Script
 *
 * This script checks the health of all services in the development environment:
 * 1. Database connectivity
 * 2. API health endpoints
 * 3. Frontend accessibility
 * 4. Port availability
 * 5. Service status
 */

class HealthChecker {
  constructor() {
    this.rootDir = join(__dirname, "..", "..")
    this.services = {
      database: {
        name: "PostgreSQL Database",
        port: parseInt(process.env.POSTGRES_PORT || "5432"),
        status: "unknown",
      },
      api: {
        name: "Messaging API",
        port: parseInt(process.env.API_PORT || "8002"),
        status: "unknown",
      },
      frontend: {
        name: "Messaging Frontend",
        port: parseInt(process.env.FRONTEND_PORT || "3002"),
        status: "unknown",
      },
      maildev: {
        name: "MailDev",
        port: parseInt(process.env.MAILDEV_PORT || "1080"),
        status: "unknown",
      },
    }
    this.errors = []
    this.warnings = []
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

  async run() {
    this.log("🏥 Starting health check...", "info")

    try {
      await this.checkDatabase()
      await this.checkAPI()
      await this.checkFrontend()
      await this.checkMailDev()
      await this.checkPorts()

      this.printReport()
    } catch (error) {
      this.log(`Health check failed: ${error.message}`, "error")
      process.exit(1)
    }
  }

  async checkDatabase() {
    this.log("Checking database connectivity...", "info")

    try {
      const dbHost = process.env.POSTGRES_HOST || "localhost"
      const dbPort = process.env.POSTGRES_PORT || "5432"
      const dbUser = process.env.POSTGRES_USER || "postgres"
      const dbPassword = process.env.POSTGRES_PASSWORD || "postgres"
      const dbName = process.env.POSTGRES_DB_NAME || "postgres"

      // Check if PostgreSQL is running
      execSync(`pg_isready -h ${dbHost} -p ${dbPort} -U ${dbUser}`, {
        stdio: "ignore",
      })

      // Test database connection
      // Create a temporary .pgpass file
      const pgpassContent = `${dbHost}:${dbPort}:${dbName}:${dbUser}:${dbPassword}\n`
      const tmpDir = os.tmpdir()
      const tmpFile = path.join(
        tmpDir,
        `.pgpass_${crypto.randomBytes(8).toString("hex")}`,
      )
      fs.writeFileSync(tmpFile, pgpassContent, { mode: 0o600 })
      let result
      try {
        result = execSync(
          `psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} -c "SELECT 1;"`,
          {
            encoding: "utf8",
            stdio: "pipe",
            env: { ...process.env, PGPASSFILE: tmpFile },
          },
        )
      } finally {
        fs.unlinkSync(tmpFile)
      }

      if (result.includes("1")) {
        this.services.database.status = "healthy"
        this.log(`Database is healthy (${dbHost}:${dbPort})`, "success")
      } else {
        this.services.database.status = "unhealthy"
        this.errors.push("Database connection test failed")
      }
    } catch (error) {
      this.services.database.status = "unhealthy"
      this.warnings.push(
        `Database not running or not accessible: ${error.message}`,
      )
    }
  }

  async checkAPI() {
    this.log("Checking API health...", "info")

    try {
      const apiPort = process.env.API_PORT || "8002"
      const response = await this.makeRequest(
        `http://localhost:${apiPort}/health`,
      )

      if (response.statusCode === 200) {
        this.services.api.status = "healthy"
        this.log("API is healthy", "success")

        // Parse response to check specific health indicators
        const data = JSON.parse(response.data)
        if (data["messaging-api"]) {
          this.log(`API version: ${data["messaging-api"]}`, "info")
        }
      } else {
        this.services.api.status = "unhealthy"
        this.errors.push(`API returned status ${response.statusCode}`)
      }
    } catch (error) {
      this.services.api.status = "unhealthy"
      this.warnings.push(`API not running or not accessible: ${error.message}`)
    }
  }

  async checkFrontend() {
    this.log("Checking frontend accessibility...", "info")

    try {
      const frontendPort = process.env.FRONTEND_PORT || "3002"
      const response = await this.makeRequest(
        `http://localhost:${frontendPort}`,
      )

      // Accept both 200 (OK) and 307 (Temporary Redirect) as healthy
      if (response.statusCode === 200 || response.statusCode === 307) {
        this.services.frontend.status = "healthy"
        this.log(
          `Frontend is accessible (status: ${response.statusCode})`,
          "success",
        )
      } else {
        this.services.frontend.status = "unhealthy"
        this.errors.push(`Frontend returned status ${response.statusCode}`)
      }
    } catch (error) {
      this.services.frontend.status = "unhealthy"
      this.warnings.push(
        `Frontend not running or not accessible: ${error.message}`,
      )
    }
  }

  async checkMailDev() {
    this.log("Checking MailDev...", "info")

    try {
      const maildevPort = process.env.MAILDEV_PORT || "1080"
      const response = await this.makeRequest(
        `http://localhost:${maildevPort}/healthz`,
      )

      if (response.statusCode === 200) {
        this.services.maildev.status = "healthy"
        this.log("MailDev is healthy", "success")
      } else {
        this.services.maildev.status = "unhealthy"
        this.warnings.push(`MailDev returned status ${response.statusCode}`)
      }
    } catch (error) {
      this.services.maildev.status = "unhealthy"
      this.warnings.push(
        `MailDev not running or not accessible: ${error.message}`,
      )
    }
  }

  async checkPorts() {
    this.log("Checking port availability...", "info")

    for (const [_, config] of Object.entries(this.services)) {
      try {
        const isPortInUse = await this.isPortInUse(config.port)

        if (isPortInUse) {
          this.log(`Port ${config.port} (${config.name}) is in use`, "success")
        } else {
          // Only warn if the service is not healthy (might be a false positive)
          if (config.status !== "healthy") {
            this.warnings.push(
              `Port ${config.port} (${config.name}) is not in use`,
            )
          }
        }
      } catch (error) {
        this.warnings.push(
          `Could not check port ${config.port}: ${error.message}`,
        )
      }
    }
  }

  async makeRequest(url) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith("https") ? https : http
      const timeout = 5000 // 5 seconds

      const req = client.get(url, { timeout }, (res) => {
        let data = ""

        res.on("data", (chunk) => {
          data += chunk
        })

        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            data: data,
          })
        })
      })

      req.on("error", (error) => {
        reject(error)
      })

      req.on("timeout", () => {
        req.destroy()
        reject(new Error("Request timeout"))
      })
    })
  }

  async isPortInUse(port) {
    try {
      const { default: net } = await import("node:net")

      return new Promise((resolve) => {
        const server = net.createServer()

        server.listen(port, () => {
          server.close()
          resolve(false) // Port is available
        })

        server.on("error", () => {
          resolve(true) // Port is in use
        })
      })
    } catch {
      return false // Assume port is available if we can't check
    }
  }

  printReport() {
    console.log("\n📊 Health Check Report")
    console.log("=====================")

    // Service status
    console.log("\n🔧 Service Status:")
    for (const [_, config] of Object.entries(this.services)) {
      const statusIcon = {
        healthy: "✅",
        unhealthy: "❌",
        unknown: "❓",
      }[config.status]

      console.log(
        `${statusIcon} ${config.name} (${config.port}): ${config.status}`,
      )
    }

    // Errors
    if (this.errors.length > 0) {
      console.log("\n❌ Errors:")
      this.errors.forEach((error) => console.log(`  - ${error}`))
    }

    // Warnings
    if (this.warnings.length > 0) {
      console.log("\n⚠️  Warnings:")
      this.warnings.forEach((warning) => console.log(`  - ${warning}`))
    }

    // Summary
    const healthyServices = Object.values(this.services).filter(
      (s) => s.status === "healthy",
    ).length
    const totalServices = Object.keys(this.services).length

    console.log(
      `\n📈 Summary: ${healthyServices}/${totalServices} services healthy`,
    )

    if (this.errors.length === 0 && this.warnings.length === 0) {
      this.log("🎉 All services are healthy!", "success")
    } else if (this.errors.length === 0) {
      this.log(
        "⚠️  Some services are not running, but no critical errors",
        "warning",
      )
      this.log("💡 Start services with: pnpm dev", "info")
    } else {
      this.log("❌ Critical errors detected", "error")
      process.exit(1)
    }
  }
}

// Run the health check
const healthChecker = new HealthChecker()
try {
  await healthChecker.run()
} catch (error) {
  console.error("Health check failed:", error)
  process.exit(1)
}
