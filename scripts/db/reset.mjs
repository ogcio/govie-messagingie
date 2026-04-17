import { execSync } from "node:child_process"
import { dirname, join } from "node:path"
import readline from "node:readline"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Database Reset Script
 *
 * This script provides a safe way to reset the database:
 * 1. Drops the existing database
 * 2. Creates a new database
 * 3. Runs all migrations
 * 4. Syncs event summaries
 * 5. Optionally seeds with test data
 */

class DatabaseReset {
  constructor() {
    this.rootDir = join(__dirname, "..", "..")
    this.force = process.argv.includes("--force")
    this.seed = process.argv.includes("--seed")
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
      await this.dropDatabase()
      await this.createDatabase()
      await this.runMigrations()

      if (this.seed) {
        await this.seedDatabase()
      }

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

  async dropDatabase() {
    this.log("Dropping existing database...", "info")

    try {
      execSync("pnpm --filter messaging-api db:drop", {
        cwd: this.rootDir,
        stdio: "inherit",
      })
      this.log("Database dropped successfully", "success")
    } catch (error) {
      throw new Error(`Failed to drop database: ${error.message}`)
    }
  }

  async createDatabase() {
    this.log("Creating new database...", "info")

    try {
      execSync("pnpm --filter messaging-api db:create", {
        cwd: this.rootDir,
        stdio: "inherit",
      })
      this.log("Database created successfully", "success")
    } catch (error) {
      throw new Error(`Failed to create database: ${error.message}`)
    }
  }

  async runMigrations() {
    this.log("Running database migrations...", "info")

    try {
      execSync("pnpm --filter messaging-api db:migrate", {
        cwd: this.rootDir,
        stdio: "inherit",
      })
      this.log("Migrations completed successfully", "success")
    } catch (error) {
      throw new Error(`Failed to run migrations: ${error.message}`)
    }
  }

  async syncEventSummary() {
    this.log("Syncing event summaries...", "info")

    try {
      execSync("pnpm --filter messaging-api sync-event-summary", {
        cwd: this.rootDir,
        stdio: "inherit",
      })
      this.log("Event summaries synced successfully", "success")
    } catch (error) {
      throw new Error(`Failed to sync event summaries: ${error.message}`)
    }
  }

  async seedDatabase() {
    this.log("Seeding database with test data...", "info")

    try {
      // Run the seed script from the messaging-api directory
      execSync(`cd apps/messaging-api && tsx --env-file=.env seed-db.mjs`, {
        cwd: this.rootDir,
        stdio: "inherit",
      })
      this.log("Database seeded successfully", "success")
    } catch (error) {
      throw new Error(`Failed to seed database: ${error.message}`)
    }
  }

  printNextSteps() {
    console.log("\n📋 Next Steps:")
    console.log("1. Start development servers: pnpm dev")
    console.log("2. Check database health: pnpm scripts:health-check")

    if (this.seed) {
      console.log("3. Test data has been loaded for development")
    }
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
