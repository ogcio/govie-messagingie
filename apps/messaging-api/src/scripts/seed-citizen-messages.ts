/**
 * Dev-only seeder: inserts delivered inbox messages for a citizen so local
 * verification of the Unified Inbox (folders / move / delete) has real data.
 *
 * Refuses to run when NODE_ENV=production (see assertDevEnvironment). Production
 * container images set NODE_ENV=production; locally it is unset/development.
 *
 * Usage (from apps/messaging-api):
 *   pnpm tsx --env-file=.env ./src/scripts/seed-citizen-messages.ts
 *
 * Env overrides:
 *   SEED_USER_ID   Logto user id of the recipient (default: ts75kydtaqn4 = Andrew Parker)
 *   SEED_ORG_ID    organisation_id to stamp on the messages (default: ogcio)
 *   SEED_COUNT     number of messages to create (default: 8)
 *   SEED_CLEAN     when "true", deletes this user's existing untagged inbox
 *                  messages before inserting (default: false)
 */
import { Pool } from "pg";

const USER_ID = process.env.SEED_USER_ID ?? "ts75kydtaqn4";
const ORG_ID = process.env.SEED_ORG_ID ?? "ogcio";
const COUNT = Number(process.env.SEED_COUNT ?? "8");
const CLEAN = process.env.SEED_CLEAN === "true";

/**
 * Hard guard: this seeder must never run outside a developer's local / dev
 * environment. Production container images set NODE_ENV=production; locally the
 * variable is unset or "development", so we block only the production value.
 */
function assertDevEnvironment(): void {
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();

  if (nodeEnv === "production") {
    throw new Error(
      `Refusing to run seeder with NODE_ENV="${process.env.NODE_ENV ?? ""}". ` +
        `This script is dev-only.`,
    );
  }
}

const SENDERS = [
  "Department of Social Protection",
  "Revenue Commissioners",
  "Health Service Executive",
  "Department of Transport",
  "Citizens Information",
];

const SUBJECTS = [
  "Your application has been received",
  "Action required: confirm your details",
  "Your payment has been processed",
  "Appointment confirmation",
  "Important update to your account",
  "Your document is ready to view",
  "Reminder: upcoming deadline",
  "Welcome to MyGovId services",
  "Your request has been completed",
  "Notice regarding your recent submission",
];

function buildPool(): Pool {
  const {
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_HOST,
    POSTGRES_PORT,
    POSTGRES_DB_NAME,
  } = process.env;

  if (!POSTGRES_DB_NAME) {
    throw new Error(
      "Missing POSTGRES_* env vars. Run with: tsx --env-file=.env ./src/scripts/seed-citizen-messages.ts",
    );
  }

  return new Pool({
    user: POSTGRES_USER,
    password: POSTGRES_PASSWORD,
    host: POSTGRES_HOST,
    port: POSTGRES_PORT ? Number(POSTGRES_PORT) : 5432,
    database: POSTGRES_DB_NAME,
  });
}

async function main(): Promise<void> {
  assertDevEnvironment();

  const pool = buildPool();

  try {
    if (CLEAN) {
      const deleted = await pool.query(
        `DELETE FROM messages WHERE user_id = $1 AND tag_id IS NULL AND deleted_at IS NULL`,
        [USER_ID],
      );
      console.log(
        `Removed ${deleted.rowCount ?? 0} existing untagged inbox message(s) for ${USER_ID}.`,
      );
    }

    const now = Date.now();
    let inserted = 0;

    for (let i = 0; i < COUNT; i++) {
      const sender = SENDERS[i % SENDERS.length];
      const subject = SUBJECTS[i % SUBJECTS.length];
      // Stagger scheduled_at into the past (newest first) so ordering is stable.
      const scheduledAt = new Date(now - (i + 1) * 36 * 60 * 60 * 1000);
      const isSeen = i % 3 !== 0; // ~1/3 unread
      const body = `This is a seeded message from ${sender}. ${subject}.`;

      await pool.query(
        `INSERT INTO messages (
            organisation_id, user_id, is_delivered, thread_name, lang, is_seen,
            security_level, subject, excerpt, rich_text, plain_text,
            scheduled_at, created_at, updated_at, tag_id
         ) VALUES (
            $1, $2, true, $3, 'en', $4,
            'public', $5, $6, $7, $8,
            $9, $9, now(), NULL
         )`,
        [
          ORG_ID,
          USER_ID,
          sender,
          isSeen,
          subject,
          body,
          `<p>${body}</p>`,
          body,
          scheduledAt.toISOString(),
        ],
      );
      inserted++;
    }

    console.log(
      `Seeded ${inserted} inbox message(s) for user ${USER_ID} (org ${ORG_ID}).`,
    );

    const total = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM messages WHERE user_id = $1 AND tag_id IS NULL AND deleted_at IS NULL`,
      [USER_ID],
    );
    console.log(
      `User ${USER_ID} now has ${total.rows[0]?.count ?? "?"} untagged inbox message(s).`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Seeder failed:", error);
  process.exit(1);
});
