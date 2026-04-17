import { profilePool } from "../pg"
import type {
  Consent,
  LinkProfileQueryRow,
  ProfileLinkParams,
  ProfileQueryRow,
  Result,
  WhereClause,
} from "../types"
import {
  failure,
  GENERIC_USER_ERROR,
  PROFILE_NOT_FOUND_FOR_EMAIL,
  PROFILE_NOT_FOUND_FOR_ID,
  success,
} from "../utils"

export async function queryRelatedUsersByUserId(
  userId: string,
): Promise<
  Result<
    {
      id: string
      primary_user_id: string
      email: string
      public_name: string
    }[]
  >
> {
  try {
    // using the lateral join we get the latest private details first
    // then, if it doesn't exist, we get the first organisation detail we find
    const queryRes = await profilePool.query<{
      id: string
      primary_user_id: string
      email: string
      public_name: string
    }>(
      `
      SELECT 
          p.id, 
          p.primary_user_id, 
          p.public_name, 
          pdata.value AS email
      FROM profiles p
      JOIN LATERAL (
          SELECT pd.*
          FROM profile_details pd
          WHERE pd.profile_id = p.id
            AND pd.is_latest = true
          ORDER BY (pd.organisation_id IS NULL) DESC
          LIMIT 1
      ) pd ON true
      JOIN profile_data pdata 
        ON pdata.profile_details_id = pd.id 
      AND pdata.name = 'email' 
      AND pdata.value IS NOT NULL
      WHERE p.primary_user_id = $1 
      --- the or surrounded by () makes us able to also get the
      --- parent profile, if the userId provided is of a child profile
        OR p.id = $1 OR (p.id <> $1 AND p.id IN (SELECT primary_user_id FROM profiles WHERE id = $1));
      `,
      [userId],
    )

    if (!queryRes.rows.length) {
      return failure(new Error("profile not found"), PROFILE_NOT_FOUND_FOR_ID)
    }

    return success(queryRes.rows)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function queryProfileLinkDetails(
  params: ProfileLinkParams,
): Promise<Result<LinkProfileQueryRow>> {
  try {
    const qureyRes = await profilePool.query<LinkProfileQueryRow>(
      `
      WITH target AS (
        SELECT
          id,
          email,
          public_name,
          primary_user_id
        FROM profiles
        WHERE
          ($2 = 'email' AND email = $1)
          OR
          ($2 = 'id' AND id = $1)
      )
      SELECT
        t.id,
        t.email,
        t.public_name,
        t.primary_user_id,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'email', p.email,
                'public_name', p.public_name,
                'is_primary', p.id = p.primary_user_id
              )
            )
            FROM profiles p
            WHERE p.primary_user_id = t.primary_user_id
              AND p.id <> t.id
          ),
          '[]'::jsonb
        ) AS links
      FROM target t;
    `,
      [params.value, params.type],
    )

    const profile = qureyRes.rows.at(0)
    if (!profile) {
      return failure(
        new Error("profile not found"),
        PROFILE_NOT_FOUND_FOR_EMAIL,
      )
    }

    return success(profile)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function queryProfiles(
  where: WhereClause,
): Promise<Result<ProfileQueryRow[]>> {
  try {
    const query = `
          WITH pselect AS (
              SELECT
                  p.id,      
                  p.primary_user_id,
                  p.consent_statuses
              FROM profiles p             
          ), joins as (
              SELECT
                  p.*, 
                  pd.organisation_id, 
                  jsonb_object_agg(pdata.name, pdata.value) FILTER (WHERE pdata.name IS NOT NULL) AS data 
              FROM pselect p
              LEFT JOIN profile_details pd ON pd.profile_id = p.id AND pd.is_latest = true
              LEFT JOIN profile_data pdata ON pdata.profile_details_id = pd.id
              WHERE ${where.sql || "TRUE"}
              GROUP BY
                  p.id,
                  p.primary_user_id,
                  p.consent_statuses,
                  pd.organisation_id
              ORDER BY p.primary_user_id, CASE WHEN p.primary_user_id = p.id THEN 0 ELSE 1 END, p.id, pd.organisation_id NULLS FIRST
          )
          SELECT * FROM joins LIMIT 20;
      `

    const res = await profilePool.query<ProfileQueryRow>(query, where.values)

    return success(res.rows)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function queryProfile(
  profileId: string,
): Promise<Result<ProfileQueryRow[]>> {
  try {
    const queryRes = await profilePool.query<ProfileQueryRow>(
      `
            SELECT
                p.id,
                p.primary_user_id,
                p.consent_statuses,
                p.public_name,
                p.email,
                pd.organisation_id,
                jsonb_object_agg(pdata.name, pdata.value) FILTER (WHERE pdata.name IS NOT NULL) AS data,
                p.status
            FROM profiles p
            LEFT JOIN profile_details pd ON pd.profile_id = p.id
            LEFT JOIN profile_data pdata ON pdata.profile_details_id = pd.id
            WHERE p.id = $1
            GROUP BY
                p.id,
                p.primary_user_id,
                p.consent_statuses,
                pd.organisation_id
        `,
      [profileId],
    )

    return success(queryRes.rows)
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function queryAssociatedProfileIds(
  profileId: string,
): Promise<Result<string[]>> {
  try {
    const queryRes = await profilePool.query<{ id: string }>(
      `
                        SELECT id FROM profiles
                        WHERE primary_user_id = (
                            SELECT primary_user_id FROM profiles WHERE id = $1
                        );
                    `,
      [profileId],
    )
    return success(queryRes.rows.map((row) => row.id))
  } catch (err) {
    return failure(err, GENERIC_USER_ERROR)
  }
}

export async function queryConsentsForProfile(
  profileId: string,
): Promise<Result<Consent[]>> {
  try {
    const stuff = await profilePool.query<Consent>(
      `
      SELECT 
      pc.id,
      pc.created_at as "createdAt",
      pc.subject,
      pc.status,
      cs.version,
      pc.cascade_reason as "cascadeReason"
      FROM profile_consents pc
      JOIN consent_statements cs ON cs.id = pc.consent_statement_id
      LEFT JOIN profiles source_profile ON pc.cascade_source_profile_id = source_profile.id
      LEFT JOIN profiles target_profile ON pc.profile_id = target_profile.id
      WHERE pc.profile_id = $1
      ORDER BY pc.created_at DESC;
      `,
      [profileId],
    )

    return success(stuff.rows)
  } catch (err) {
    console.error(err)
    return failure(err, GENERIC_USER_ERROR)
  }
}
