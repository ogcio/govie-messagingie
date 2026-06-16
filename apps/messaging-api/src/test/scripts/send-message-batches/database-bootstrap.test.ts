import { Client } from "pg";
import { describe, expect, it } from "vitest";
import { createBatchDatabase } from "../../../scripts/send-message-batches/database/create-database.js";
import { migrateBatchDatabase } from "../../../scripts/send-message-batches/database/migrate.js";
import {
  createDatabasePool,
  getDatabaseConnectionString,
} from "../../../scripts/send-message-batches/database/shared.js";
import type { DatabaseConfig } from "../../../scripts/send-message-batches/domain/types.js";
import {
  getConfigFromContainer,
  startPostgresContainer,
} from "../../build-testcontainer-pg.js";

const EXPECTED_TABLES = [
  "batch_messages",
  "batch_recipients",
  "batch_runs",
] as const;

const EXPECTED_INDEXES = [
  "batch_messages_external_message_id_idx",
  "batch_messages_run_profile_id_idx",
  "batch_messages_run_send_status_sent_at_idx",
  "batch_messages_run_sent_order_idx",
  "batch_recipients_run_id_idx",
  "batch_runs_fingerprint_created_at_idx",
  "batch_runs_run_fingerprint_idx",
  "batch_runs_status_idx",
  "batch_runs_unfinished_fingerprint_uidx",
] as const;

describe("send-message-batches database bootstrap", () => {
  it("rejects unsafe database names before opening a connection", async () => {
    const invalidDatabaseConfigs: DatabaseConfig[] = [
      {
        user: "postgres",
        password: "postgres",
        host: "localhost",
        port: 5432,
        databaseName: "BatchDB",
      },
      {
        user: "postgres",
        password: "postgres",
        host: "localhost",
        port: 5432,
        databaseName: "123batchdb",
      },
    ];

    await Promise.all(
      invalidDatabaseConfigs.map(async (databaseConfig) => {
        expect(() => getDatabaseConnectionString(databaseConfig)).toThrowError(
          /Unsafe database name/,
        );
        expect(() => createDatabasePool(databaseConfig)).toThrowError(
          /Unsafe database name/,
        );
        await expect(createBatchDatabase(databaseConfig)).rejects.toThrowError(
          /Unsafe database name/,
        );
        await expect(migrateBatchDatabase(databaseConfig)).rejects.toThrowError(
          /Unsafe database name/,
        );
      }),
    );
  });

  it("creates the database and applies local migrations idempotently", async () => {
    const container = await startPostgresContainer();

    try {
      const databaseConfig = createDatabaseConfig(
        "send_message_batches_bootstrap",
        getConfigFromContainer(container),
      );

      await createBatchDatabase(databaseConfig);
      await createBatchDatabase(databaseConfig);
      await migrateBatchDatabase(databaseConfig);
      await migrateBatchDatabase(databaseConfig);

      const client = new Client({
        connectionString: getDatabaseConnectionString(databaseConfig),
      });

      try {
        await client.connect();

        const currentDatabaseResult = await client.query<{
          current_database: string;
        }>("SELECT current_database() AS current_database");
        expect(currentDatabaseResult.rows[0]?.current_database).toBe(
          databaseConfig.databaseName,
        );

        const tableResult = await client.query<{ table_name: string }>(
          `
            SELECT tablename AS table_name
            FROM pg_tables
            WHERE schemaname = 'public'
              AND tablename = ANY($1::text[])
            ORDER BY tablename
          `,
          [Array.from(EXPECTED_TABLES)],
        );

        expect(tableResult.rows.map((row) => row.table_name)).toEqual([
          ...EXPECTED_TABLES,
        ]);

        const indexResult = await client.query<{ indexname: string }>(
          `
            SELECT indexname
            FROM pg_indexes
            WHERE schemaname = 'public'
              AND indexname = ANY($1::text[])
            ORDER BY indexname
          `,
          [Array.from(EXPECTED_INDEXES)],
        );

        expect(indexResult.rows.map((row) => row.indexname)).toEqual([
          ...EXPECTED_INDEXES,
        ]);

        const migrationResult = await client.query<{
          version: string;
          name: string;
        }>(
          "SELECT version, name FROM postgrator_migrations WHERE version <> '0' ORDER BY version",
        );

        expect(migrationResult.rows).toEqual([
          {
            version: "1",
            name: "tables",
          },
          {
            version: "2",
            name: "unfinished-run-guard",
          },
        ]);
      } finally {
        await client.end();
      }
    } finally {
      await container.stop();
    }
  }, 120_000);

  it("reconciles legacy duplicate unfinished runs before adding the guard", async () => {
    const container = await startPostgresContainer();

    try {
      const databaseConfig = createDatabaseConfig(
        "send_message_batches_legacy_guard",
        getConfigFromContainer(container),
      );

      await createBatchDatabase(databaseConfig);
      await migrateBatchDatabase(databaseConfig, "1");

      const client = new Client({
        connectionString: getDatabaseConnectionString(databaseConfig),
      });

      try {
        await client.connect();
        await client.query(
          `
            insert into batch_runs (
              run_fingerprint,
              status,
              organization_id,
              message_subject,
              send_at_mode,
              send_at_value,
              csv_content_hash,
              html_content_hash,
              txt_content_hash,
              template_variables_schema_version,
              operational_settings_snapshot,
              created_at,
              updated_at
            )
            values
              (
                'legacy-fingerprint',
                'created',
                'org-1',
                'Older run',
                'immediate',
                null,
                'csv-hash-old',
                'html-hash-old',
                'txt-hash-old',
                'v1',
                '{}'::jsonb,
                '2026-05-26T10:00:00.000Z',
                '2026-05-26T10:00:00.000Z'
              ),
              (
                'legacy-fingerprint',
                'created',
                'org-1',
                'Newer run',
                'immediate',
                null,
                'csv-hash-new',
                'html-hash-new',
                'txt-hash-new',
                'v1',
                '{}'::jsonb,
                '2026-05-26T10:01:00.000Z',
                '2026-05-26T10:01:00.000Z'
              )
          `,
        );
      } finally {
        await client.end();
      }

      await migrateBatchDatabase(databaseConfig);

      const verificationClient = new Client({
        connectionString: getDatabaseConnectionString(databaseConfig),
      });

      try {
        await verificationClient.connect();

        const { rows } = await verificationClient.query<{
          status: string;
          messageSubject: string;
        }>(
          `
            select
              status,
              message_subject as "messageSubject"
            from batch_runs
            where run_fingerprint = 'legacy-fingerprint'
            order by created_at desc
          `,
        );

        expect(rows).toEqual([
          {
            status: "created",
            messageSubject: "Newer run",
          },
          {
            status: "superseded",
            messageSubject: "Older run",
          },
        ]);
      } finally {
        await verificationClient.end();
      }
    } finally {
      await container.stop();
    }
  }, 120_000);
});

function createDatabaseConfig(
  databaseName: string,
  containerConfig: {
    POSTGRES_DB_NAME: string;
    POSTGRES_HOST: string;
    POSTGRES_PASSWORD: string;
    POSTGRES_PORT: number;
    POSTGRES_USER: string;
  },
): DatabaseConfig {
  return {
    user: containerConfig.POSTGRES_USER,
    password: containerConfig.POSTGRES_PASSWORD,
    host: containerConfig.POSTGRES_HOST,
    port: containerConfig.POSTGRES_PORT,
    databaseName,
  };
}
