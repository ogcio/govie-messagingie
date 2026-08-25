import type { Pool, PoolClient } from "pg";
import pino, { type Logger } from "pino";
import type { SeederConsentStatements } from "~/migrations/consent-statements/seeder-consent-statement.js";
import { statements as messagingStatements } from "~/migrations/consent-statements/to-seed-statements/messaging.js";
import {
  type ConsentSubject,
  ConsentSubjects,
} from "~/schemas/consents/shared.js";
import { createConsentStatement } from "~/services/consent-statements/consent-statements-service.js";

export async function seedConsentStatements(inputPool: Pool): Promise<void> {
  const toSeedForSubject = getStatementsToSeedForSubject();
  const logger = pino.pino();
  const client = await inputPool.connect();
  try {
    for (const [subject, toSeed] of Object.entries(toSeedForSubject)) {
      logger.info({ message: "Starting seeding", subject });
      await seedForSubject(subject, toSeed, client, logger);
      logger.info({ message: "Ended seeding", subject });
    }
  } finally {
    client.release();
    logger.info({ message: "Client released" });
  }
}

function getStatementsToSeedForSubject(): Record<
  ConsentSubject,
  SeederConsentStatements
> {
  return {
    [ConsentSubjects.Messaging]: messagingStatements,
  };
}

async function seedForSubject(
  subject: string,
  inputStatement: SeederConsentStatements,
  client: PoolClient,
  logger: Logger,
) {
  try {
    const exists = await doesStatementAlreadyExist(subject, client);
    if (exists) {
      logger.info(
        { subject },
        "Already has consent statements, skipping seeding",
      );
      return;
    }
    await client.query("BEGIN;");
    logger.info({ subject }, "Start seeding");

    const publishDate = new Date(inputStatement.publish_date);
    const now = new Date();
    let postponedDate = 0;
    if (publishDate < now) {
      postponedDate = 10;
      publishDate.setSeconds(publishDate.getSeconds() + postponedDate);
    }

    const id = await createConsentStatement({
      client,
      logger,
      consentStatement: {
        ...inputStatement,
        publishDate: publishDate.toISOString(),
        isEnabled: true,
        subject,
      },
      loggedInUserId: null,
    });
    logger.info({ message: "Version created", subject, id });

    await client.query("COMMIT;");
    if (postponedDate > 0) {
      // Wait for a short while to ensure the just created statement
      // is the current one
      await new Promise((resolve) => setTimeout(resolve, postponedDate * 1000));
    }
    logger.info({ message: "Committed", subject });
  } catch (e) {
    logger.error({ error: e }, `Error while seeding consents for ${subject}`);
    await client.query("ROLLBACK;");
  }
}

async function doesStatementAlreadyExist(
  subject: string,
  client: PoolClient,
): Promise<boolean> {
  try {
    const idResponse = await client.query<{ id: string }>(
      "SELECT id FROM consent_statements WHERE subject = $1 LIMIT 1",
      [subject],
    );
    const latest = idResponse.rows[0]?.id ?? null;
    return latest !== null;
  } catch {
    return false;
  }
}
