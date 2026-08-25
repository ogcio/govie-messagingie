import { httpErrors } from "@fastify/sensible";
import type { Pool } from "pg";
import type {
  ProfileWithDetails,
  ProfileWithDetailsFromDb,
} from "~/schemas/profiles/model.js";
import { parseProfileDetails } from "~/schemas/profiles/shared.js";
import { withClient } from "~/utils/with-client.js";

export const findProfile = async (params: {
  pool: Pool;
  organizationId: string;
  query: Record<string, string>;
  consentSubjects: string[];
}): Promise<ProfileWithDetails> =>
  withClient(params.pool, async (client) => {
    const { email, firstName, lastName, phone } = params.query;

    // Build dynamic WHERE clauses based on provided search params
    const conditions = [];
    const values: (string | string[])[] = [params.organizationId];
    let paramIndex = 2;

    if (email) {
      conditions.push(`(p.email ILIKE $${paramIndex} OR EXISTS (
            SELECT 1 FROM profile_data pd
            WHERE pd.profile_details_id = pdet.id
            AND pd.name = 'email'
            AND pd.value_type = 'string'
            AND pd.value ILIKE $${paramIndex}
          ))`);
      values.push(`%${email}%`);
      paramIndex++;
    }

    if (firstName) {
      conditions.push(`EXISTS (
            SELECT 1 FROM profile_data pd
            WHERE pd.profile_details_id = pdet.id
            AND pd.name = 'firstName'
            AND pd.value_type = 'string'
            AND pd.value ILIKE $${paramIndex}
          )`);
      values.push(`%${firstName}%`);
      paramIndex++;
    }

    if (lastName) {
      conditions.push(`EXISTS (
            SELECT 1 FROM profile_data pd
            WHERE pd.profile_details_id = pdet.id
            AND pd.name = 'lastName'
            AND pd.value_type = 'string'
            AND pd.value ILIKE $${paramIndex}
          )`);
      values.push(`%${lastName}%`);
      paramIndex++;
    }

    if (phone) {
      conditions.push(`EXISTS (
            SELECT 1 FROM profile_data pd
            WHERE pd.profile_details_id = pdet.id
            AND pd.name = 'phone'
            AND pd.value_type = 'string'
            AND pd.value ILIKE $${paramIndex}
          )`);
      values.push(`%${phone}%`);
      paramIndex++;
    }

    const whereClause = conditions.length
      ? `AND (${conditions.join(" AND ")})`
      : "";
    values.push(params.consentSubjects);
    // Query using indexes for performance
    const { rows } = await client.query<ProfileWithDetailsFromDb>(
      `
          SELECT DISTINCT
            p.id,
            p.public_name as "publicName",
            p.email,
            p.primary_user_id as "primaryUserId",
            p.safe_level as "safeLevel",
            p.created_at as "createdAt",
            p.updated_at as "updatedAt",
            p.preferred_language as "preferredLanguage",
            p.status,
            CASE
            WHEN array_length($${paramIndex}::text[], 1) IS NULL OR p.consent_statuses IS NULL THEN NULL
            ELSE (
              SELECT jsonb_object_agg(key, value)
              FROM jsonb_each(p.consent_statuses)
              WHERE key = ANY($${paramIndex}::text[])
            ) END AS "consentStatuses",
            (
              SELECT jsonb_object_agg(pdata.name, 
                jsonb_build_object(
                  'value', pdata.value,
                  'type', pdata.value_type
                )
              )
              FROM profile_data pdata
              WHERE pdata.profile_details_id = pdet.id
            ) as details
          FROM profiles p
          INNER JOIN profile_details pdet 
            ON pdet.profile_id = p.id 
            AND pdet.organisation_id = $1
            AND pdet.is_latest = true
          WHERE p.deleted_at IS NULL
          ${whereClause}
          ORDER BY p.created_at DESC
          LIMIT 1
        `,
      values,
    );

    if (rows[0]) {
      return parseProfileDetails(rows[0]);
    }

    throw httpErrors.notFound("Profile not found");
  });
