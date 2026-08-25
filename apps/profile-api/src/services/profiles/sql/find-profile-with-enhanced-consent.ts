import type { PoolClient } from "pg";
import type {
  AvailableLanguages,
  ConsentStatusDetail,
  KnownProfileDbDataDetails,
  ProfileStatus,
} from "~/schemas/profiles/model.js";
import { toIsoDateTime } from "~/utils/dates.js";

export interface ProfileWithEnhancedConsent {
  id: string;
  publicName: string;
  email: string;
  primaryUserId: string;
  createdAt?: string;
  updatedAt?: string;
  preferredLanguage?: AvailableLanguages;
  consentStatuses: Record<string, ConsentStatusDetail> | null;
  details?: KnownProfileDbDataDetails;
  status: ProfileStatus;
}

export const findProfileWithEnhancedConsent = async (
  client: PoolClient,
  organizationId: string | undefined,
  profileId: string,
  consentSubjects: string[],
): Promise<ProfileWithEnhancedConsent | undefined> => {
  let organizationClause = " IS NULL ";
  const values: (string | string[] | null)[] = [profileId];
  let nextIndex = 2;

  if (organizationId !== undefined) {
    organizationClause = ` = $${nextIndex++} `;
    values.push(organizationId);
  }

  // First get the profile basic info
  const profileResult = await client.query(
    `
    SELECT 
      p.id,
      p.public_name as "publicName",
      p.email,
      p.primary_user_id as "primaryUserId",
      p.created_at as "createdAt",
      p.updated_at as "updatedAt",
      p.preferred_language as "preferredLanguage",
      p.status,
      (
        SELECT jsonb_object_agg(pdata.name, 
        jsonb_build_object(
            'value', pdata.value,
            'type', pdata.value_type
        )
        )
        FROM profile_data pdata
        INNER JOIN profile_details pd ON pd.id = pdata.profile_details_id
        WHERE pd.profile_id = p.id 
        AND pd.organisation_id ${organizationClause}
        AND pd.is_latest = true
      ) as details
    FROM profiles p
    WHERE p.id = $1
    AND p.deleted_at IS NULL
    `,
    values.slice(0, nextIndex - 1),
  );

  if (!profileResult.rows || profileResult.rows.length === 0) {
    return undefined;
  }

  const profile = profileResult.rows[0];

  // If no consent subjects requested, return profile with null consent statuses
  if (!consentSubjects || consentSubjects.length === 0) {
    return {
      ...profile,
      consentStatuses: null,
    };
  }

  // Quick check to see if there's any consent data for the requested subjects
  const consentExistsResult = await client.query(
    `
    SELECT EXISTS(
      SELECT 1 
      FROM profile_consents pc
      WHERE pc.profile_id = $1
      AND pc.subject = ANY($2::text[])
      LIMIT 1
    ) as has_consent_data
    `,
    [profileId, consentSubjects],
  );

  // If no consent data exists for any of the requested subjects, return early
  if (!consentExistsResult.rows[0]?.has_consent_data) {
    return {
      ...profile,
      consentStatuses: null,
    };
  }

  // Get enhanced consent information for requested subjects
  const consentResult = await client.query(
    `
    WITH latest_consents AS (
      SELECT DISTINCT ON (pc.subject) 
        pc.subject,
        pc.status,
        pc.created_at as submitted_at,
        pc.consent_statement_id as statement_id,
        cs.version as statement_version
      FROM profile_consents pc
      JOIN consent_statements cs ON cs.id = pc.consent_statement_id
      WHERE pc.profile_id = $1
      AND pc.subject = ANY($2::text[])
      ORDER BY pc.subject, pc.created_at DESC
    ),
    latest_statements AS (
      SELECT DISTINCT ON (cs.subject)
        cs.subject,
        cs.id as latest_statement_id,
        cs.version as latest_version
      FROM consent_statements cs
      WHERE cs.subject = ANY($2::text[])
      AND cs.is_enabled = true
      AND cs.publish_date <= NOW()
      ORDER BY cs.subject, cs.publish_date DESC, cs.version DESC
    )
    SELECT 
      lc.subject as subject,
      lc.status,
      lc.submitted_at,
      lc.statement_id,
      lc.statement_version,
      CASE 
        WHEN ls.latest_statement_id = lc.statement_id THEN true 
        ELSE false 
      END as is_latest_statement
    FROM latest_consents lc
    LEFT JOIN latest_statements ls ON ls.subject = lc.subject
    `,
    [profileId, consentSubjects],
  );

  // Build enhanced consent statuses object
  const consentStatuses: Record<string, ConsentStatusDetail> = {};

  // Add consent data for subjects that have submissions
  for (const row of consentResult.rows) {
    consentStatuses[row.subject] = {
      subject: row.subject,
      status: row.status,
      submittedAt: toIsoDateTime(row.submitted_at),
      statementId: row.statement_id,
      statementVersion: row.statement_version,
      isLatestStatement: row.is_latest_statement,
    };
  }

  // Only return consent statuses if there are actual submissions
  // If no subjects have consent data, return null
  return {
    ...profile,
    consentStatuses:
      Object.keys(consentStatuses).length > 0 ? consentStatuses : null,
  };
};
