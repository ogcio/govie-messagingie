import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Database Reset Script
 *
 * This script provides a safe way to reset the database of every API service:
 * 1. Drops the existing databases
 * 2. Creates new databases
 * 3. Runs all migrations, followed by each service's post-migrate scripts
 *    (event summary sync, consent statement reference data)
 */

// Every backend service with its own database. Each entry lists the pnpm
// scripts to run (in order) after the database has been created and migrated.
const API_SERVICES = [
  {
    name: "messaging-api",
    postMigrate: ["sync-event-summary"],
  },
  {
    name: "upload-api",
    postMigrate: [],
  },
  {
    name: "scheduler-api",
    postMigrate: [],
  },
  {
    name: "profile-api",
    // Consent statements are required reference data, not test data
    postMigrate: ["seed-consent-statements"],
  },
]

class DatabaseReset {
  constructor() {
    this.rootDir = join(__dirname, "..", "..")
    this.force = process.argv.includes("--force")
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
    this.log("🗄️  Starting database reset...", "info")

    try {
      await this.confirmReset()
      await this.checkDatabaseConnection()
      await this.dropDatabases()
      await this.createDatabases()
      await this.runMigrations()

      this.log("🎉 Database reset completed successfully!", "success")
      this.printNextSteps()
    } catch (error) {
      this.log(`Database reset failed: ${error.message}`, "error")
      process.exit(1)
    }
  }

  async confirmReset() {
    if (this.force) {
      this.log("Force flag detected, skipping confirmation", "warning")
      return
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve, reject) => {
      rl.question(
        "⚠️  This will DESTROY all data in the database. Are you sure? (yes/no): ",
        (answer) => {
          rl.close()

          if (answer.toLowerCase() === "yes" || answer.toLowerCase() === "y") {
            this.log("Reset confirmed", "info")
            resolve()
          } else {
            reject(new Error("Database reset cancelled by user"))
          }
        },
      )
    })
  }

  async checkDatabaseConnection() {
    this.log("Checking database connection...", "info")

    try {
      const dbHost = process.env.POSTGRES_HOST || "localhost"
      const dbPort = process.env.POSTGRES_PORT || "5432"
      const dbUser = process.env.POSTGRES_USER || "postgres"
      // Check if PostgreSQL is running
      execSync(`pg_isready -h ${dbHost} -p ${dbPort} -U ${dbUser}`, {
        stdio: "ignore",
      })
      this.log(`Database connection verified (${dbHost}:${dbPort})`, "success")
    } catch (_) {
      throw new Error(
        "Cannot connect to database. Make sure PostgreSQL is running.",
      )
    }
  }

  async dropDatabases() {
    for (const service of API_SERVICES) {
      this.log(`Dropping database of ${service.name}...`, "info")

      try {
        execSync(`pnpm --filter ${service.name} db:drop`, {
          cwd: this.rootDir,
          stdio: "inherit",
        })
        this.log(`Database of ${service.name} dropped successfully`, "success")
      } catch (error) {
        throw new Error(
          `Failed to drop database of ${service.name}: ${error.message}`,
        )
      }
    }
  }

  async createDatabases() {
    for (const service of API_SERVICES) {
      this.log(`Creating database of ${service.name}...`, "info")

      try {
        execSync(`pnpm --filter ${service.name} db:create`, {
          cwd: this.rootDir,
          stdio: "inherit",
        })
        this.log(`Database of ${service.name} created successfully`, "success")
      } catch (error) {
        throw new Error(
          `Failed to create database of ${service.name}: ${error.message}`,
        )
      }
    }
  }

  async runMigrations() {
    for (const service of API_SERVICES) {
      this.log(`Running migrations of ${service.name}...`, "info")

      try {
        execSync(`pnpm --filter ${service.name} db:migrate`, {
          cwd: this.rootDir,
          stdio: "inherit",
        })

        for (const script of service.postMigrate) {
          execSync(`pnpm --filter ${service.name} ${script}`, {
            cwd: this.rootDir,
            stdio: "inherit",
          })
        }

        this.log(`Migrations of ${service.name} completed`, "success")
      } catch (error) {
        throw new Error(
          `Failed to run migrations of ${service.name}: ${error.message}`,
        )
      }
    }
  }

  printNextSteps() {
    console.log("\n📋 Next Steps:")
    console.log("1. Start development servers: pnpm dev")
    console.log("2. Check database health: pnpm scripts:health-check")
  }
}

// Run the database reset
const dbReset = new DatabaseReset()
try {
  await dbReset.run()
} catch (error) {
  console.error("Database reset failed:", error)
  process.exit(1)
}
