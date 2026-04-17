import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Database Seeding Script
 *
 * This script seeds the database with realistic test data for development:
 * 1. Creates test message templates
 * 2. Creates test providers
 *
 * Note: Users are created via Logto callbacks and are not seeded here.
 * Messages and events require valid user IDs and are not seeded here.
 */

class DatabaseSeeder {
  constructor() {
    this.rootDir = __dirname;
    this.pool = null;
  }

  log(message, type = "info") {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: "ℹ️",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    }[type];

    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  async run() {
    this.log("🌱 Starting database seeding...", "info");

    try {
      await this.connectToDatabase();
      await this.seedProviders();
      await this.seedTemplates();

      this.log("🎉 Database seeding completed successfully!", "success");
      this.printSummary();
    } catch (error) {
      this.log(`Database seeding failed: ${error.message}`, "error");
      process.exit(1);
    } finally {
      if (this.pool) {
        await this.pool.end();
      }
    }
  }

  async connectToDatabase() {
    this.log("Connecting to database...", "info");

    this.pool = new pg.Pool({
      host: process.env.POSTGRES_HOST || "localhost",
      port: parseInt(process.env.POSTGRES_PORT || "5432", 10),
      database: process.env.POSTGRES_DB_NAME || "messaging",
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD || "postgres",
    });

    try {
      await this.pool.query("SELECT 1");
      this.log("Database connection established", "success");
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error.message}`);
    }
  }

  async seedProviders() {
    this.log("Seeding providers...", "info");

    const providers = [
      {
        id: "test-email-provider",
        name: "Test Email Provider",
        type: "email",
        config: {
          host: process.env.MAILDEV_HOST || "localhost",
          port: parseInt(process.env.MAILDEV_PORT || "1025", 10),
          secure: false,
        },
      },
    ];

    for (const provider of providers) {
      try {
        await this.pool.query(
          `
            INSERT INTO providers (id, name, type, config, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
          `,
          [
            provider.id,
            provider.name,
            provider.type,
            JSON.stringify(provider.config),
          ],
        );
      } catch (error) {
        this.log(
          `Warning: Could not insert provider ${provider.id}: ${error.message}`,
          "warning",
        );
      }
    }

    this.log(`Seeded ${providers.length} providers`, "success");
  }

  async seedTemplates() {
    this.log("Seeding message templates...", "info");

    const templates = [
      {
        id: "welcome-template",
        name: "Welcome Message",
        subject: "Welcome to our service!",
        content: "Hello {{name}}, welcome to our messaging service!",
        type: "email",
        created_by: "admin-user",
      },
      {
        id: "notification-template",
        name: "Notification Message",
        subject: "Important Notification",
        content:
          "Dear {{name}}, you have an important notification: {{message}}",
        type: "email",
        created_by: "admin-user",
      },
      {
        id: "sms-template",
        name: "SMS Notification",
        content: "Hello {{name}}, your verification code is: {{code}}",
        type: "sms",
        created_by: "admin-user",
      },
    ];

    for (const template of templates) {
      try {
        await this.pool.query(
          `
            INSERT INTO message_templates (id, name, subject, content, type, created_by, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
            ON CONFLICT (id) DO NOTHING
          `,
          [
            template.id,
            template.name,
            template.subject,
            template.content,
            template.type,
            template.created_by,
          ],
        );
      } catch (error) {
        this.log(
          `Warning: Could not insert template ${template.id}: ${error.message}`,
          "warning",
        );
      }
    }

    this.log(`Seeded ${templates.length} templates`, "success");
  }

  printSummary() {
    console.log("\n📊 Seeding Summary:");
    console.log("==================");
    console.log("✅ Providers: 1 providers (email)");
    console.log("✅ Templates: 3 message templates");
    console.log("\n🎯 Test Data Available:");
    console.log("- Email Provider: Test SMTP configuration");
    console.log("- SMS Provider: Test API configuration");
    console.log("- Templates: welcome, notification, SMS");
    console.log("\n📝 Notes:");
    console.log("- Users are created via Logto callbacks");
    console.log("- Messages and events require valid user IDs");
    console.log("- Messages will be created when users send them");
  }
}

// Run the database seeder
const seeder = new DatabaseSeeder();
try {
  await seeder.run();
} catch (error) {
  console.error("Database seeding failed:", error);
  process.exit(1);
}
