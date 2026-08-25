import { randomUUID } from "node:crypto";
import type { Pool } from "pg";

export type TestAnnouncementTranslations = {
  en: { id: string; title: string; description: string };
  ga: { id: string; title: string; description: string };
};

export async function insertTestAnnouncement(
  pool: Pool,
  params: {
    applicationId: string;
    publishDate: Date;
    announcementId?: string;
    isEnabled?: boolean;
    createdBy?: string | null;
  },
): Promise<{
  id: string;
  translations: TestAnnouncementTranslations;
}> {
  const announcementId = params.announcementId ?? randomUUID();
  const isEnabled = params.isEnabled ?? true;
  const createdBy = params.createdBy ?? null;

  await pool.query(
    `INSERT INTO announcements (id, application_id, publish_date, is_enabled, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
    [
      announcementId,
      params.applicationId,
      params.publishDate,
      isEnabled,
      createdBy,
    ],
  );

  const translations: TestAnnouncementTranslations = {
    en: {
      id: randomUUID(),
      title: `Announcement ${params.applicationId}`,
      description: `English description ${params.applicationId}`,
    },
    ga: {
      id: randomUUID(),
      title: `Fogra ${params.applicationId}`,
      description: `Cur sios ${params.applicationId}`,
    },
  };

  await pool.query(
    `INSERT INTO announcement_translations
       (id, announcement_id, language, title, description)
       VALUES ($1, $2, $3, $4, $5)`,
    [
      translations.en.id,
      announcementId,
      "en",
      translations.en.title,
      translations.en.description,
    ],
  );

  await pool.query(
    `INSERT INTO announcement_translations
       (id, announcement_id, language, title, description)
       VALUES ($1, $2, $3, $4, $5)`,
    [
      translations.ga.id,
      announcementId,
      "ga",
      translations.ga.title,
      translations.ga.description,
    ],
  );

  return {
    id: announcementId,
    translations,
  };
}
