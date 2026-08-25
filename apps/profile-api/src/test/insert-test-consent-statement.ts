import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type TestStatementTranslations = {
  en: { id: string; title: string; description: string; disclaimer: string };
  ga: { id: string; title: string; description: string; disclaimer: string };
};

export async function insertTestConsentStatement(
  pool: Pool,
  params: {
    subject: string;
    version?: number;
    statementId?: string;
    publishDate: Date;
    isEnabled?: boolean;
    createdBy?: string;
  },
): Promise<{
  id: string;
  version: number;
  translations: TestStatementTranslations;
}> {
  let version = params.version;
  const statementId = params.statementId ?? randomUUID();
  const isEnabled = params.isEnabled === undefined ? true : params.isEnabled;
  const createdBy = params.createdBy ?? null;

  if (!version) {
    const latest = await pool.query<{ version: number }>(
      "SELECT MAX(version) as version FROM consent_statements WHERE subject = $1",
      [params.subject],
    );
    version =
      latest.rows.length > 0 && latest.rows[0].version
        ? Number(latest.rows[0].version) + 1
        : 1;
  }

  await pool.query(
    `INSERT INTO consent_statements (id, subject, version, created_at, publish_date, is_enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      statementId,
      params.subject,
      version,
      new Date(Date.now() - 1000),
      params.publishDate,
      isEnabled,
      createdBy,
    ],
  );

  // Insert translations
  const enTranslationId = randomUUID();
  const gaTranslationId = randomUUID();
  const translations: TestStatementTranslations = {
    en: {
      id: enTranslationId,
      title: `Title ${statementId}`,
      description: `Description ${statementId}`,
      disclaimer: `Disclaimer ${statementId}`,
    },
    ga: {
      id: gaTranslationId,
      title: `Title GA ${statementId}`,
      description: `Description GA ${statementId}`,
      disclaimer: `Disclaimer GA ${statementId}`,
    },
  };

  await pool.query(
    `INSERT INTO consent_statement_translations 
       (id, consent_statement_id, language, title, description, disclaimer)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      enTranslationId,
      statementId,
      "en",
      translations.en.title,
      translations.en.description,
      translations.en.disclaimer,
    ],
  );

  await pool.query(
    `INSERT INTO consent_statement_translations 
       (id, consent_statement_id, language, title, description, disclaimer)
       VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      gaTranslationId,
      statementId,
      "ga",
      translations.ga.title,
      translations.ga.description,
      translations.ga.disclaimer,
    ],
  );

  return { id: statementId, version, translations };
}

export async function getLatestOrInsertTestConsentStatement(
  pool: Pool,
  params: {
    subject: string;
    version?: number;
    statementId?: string;
    publishDate: Date;
    isEnabled?: boolean;
    createdBy?: string;
  },
): Promise<{
  id: string;
  version: number;
  translations: TestStatementTranslations;
}> {
  const latest = await pool.query<{
    id: string;
    version: number;
    publish_date: Date;
  }>(
    "SELECT id, version, publish_date FROM consent_statements WHERE subject = $1 AND publish_date <= NOW() AND is_enabled = true ORDER BY version DESC LIMIT 1",
    [params.subject],
  );

  if (latest.rows.length > 0) {
    const latestStatement = latest.rows[0];
    if (
      latestStatement.publish_date.getTime() === params.publishDate.getTime()
    ) {
      const translationsResult = await pool.query<{
        id: string;
        consent_statement_id: string;
        language: string;
        title: string;
        description: string;
        disclaimer: string;
      }>(
        "SELECT id, consent_statement_id, language, title, description, disclaimer FROM consent_statement_translations WHERE consent_statement_id = $1",
        [latestStatement.id],
      );

      if (translationsResult.rows.length > 0) {
        const translations: TestStatementTranslations = {
          // biome-ignore lint/style/noNonNullAssertion: testing
          en: translationsResult.rows.find((row) => row.language === "en")!,
          // biome-ignore lint/style/noNonNullAssertion: testing
          ga: translationsResult.rows.find((row) => row.language === "ga")!,
        };

        return {
          id: latestStatement.id,
          version: latestStatement.version,
          translations,
        };
      }
    }
  }

  return insertTestConsentStatement(pool, params);
}
