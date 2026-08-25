import type { ListProfilesSearchParams } from "~/schemas/profiles/list.js";

export const buildListProfilesQueries = (params: {
  organisationId: string | undefined;
  pagination: { limit: string; offset: string };
  searchParams?: Omit<ListProfilesSearchParams, "consentSubjects"> & {
    ppsns?: string[];
  };
  activeOnly?: boolean;
  consentSubjects: string[];
}): {
  count: { query: string; values: (string | number | string[] | null)[] };
  data: { query: string; values: (string | number | string[] | null)[] };
} => {
  const whereHelper = prepareWhereClauses(params);
  const nextIndexInQuery = whereHelper.nextIndexInQuery;

  const orgWhereClause = params.organisationId
    ? " AND pd.organisation_id = $1 "
    : "";

  const needsProfileData = Boolean(
    params.searchParams?.search ||
      params.searchParams?.firstName ||
      params.searchParams?.lastName ||
      params.searchParams?.email ||
      (params.searchParams?.ppsns && params.searchParams?.ppsns.length > 0),
  );

  const baseQuery = `
    FROM profiles p
    INNER JOIN profile_details pd ON pd.profile_id = p.id
    ${needsProfileData ? "INNER JOIN profile_data pdata ON pdata.profile_details_id = pd.id" : ""}
    WHERE
     pd.is_latest = true
     ${orgWhereClause}
    ${params.activeOnly ? "AND p.deleted_at IS NULL" : ""}
    ${whereHelper.whereClauses}
  `;

  return {
    count: {
      query: `SELECT COUNT(DISTINCT p.id) as count ${baseQuery}`,
      values: whereHelper.queryValues,
    },
    data: {
      query: `
       SELECT DISTINCT
          p.id,
          p.public_name as "publicName",
          p.email,
          p.primary_user_id as "primaryUserId",
          p.created_at as "createdAt",
          p.updated_at as "updatedAt",
          p.preferred_language as "preferredLanguage",
          pd.id as "profileDetailsId",
          p.status,
          CASE
            WHEN array_length($${nextIndexInQuery}::text[], 1) IS NULL OR p.consent_statuses IS NULL THEN NULL
            ELSE (
              SELECT jsonb_object_agg(key, value)
              FROM jsonb_each(p.consent_statuses)
              WHERE key = ANY($${nextIndexInQuery}::text[])
            )
          END AS "consentStatuses"
        ${baseQuery}
        ORDER BY p.created_at DESC
        LIMIT $${nextIndexInQuery + 1} OFFSET $${nextIndexInQuery + 2}
      `,
      values: [
        ...whereHelper.queryValues,
        params.consentSubjects,
        params.pagination.limit,
        params.pagination.offset,
      ],
    },
  };
};

const prepareWhereClauses = (params: {
  organisationId: string | undefined;
  searchParams?: ListProfilesSearchParams & { ppsns?: string[] };
}): {
  whereClauses: string;
  queryValues: (string | number | string[])[];
  nextIndexInQuery: number;
} => {
  const whereClauses = [];
  const queryValues: (string | string[])[] = params.organisationId
    ? [params.organisationId]
    : [];

  let nextIndexInQuery = params.organisationId ? 2 : 1;
  const search = params.searchParams?.search?.trim() || "";
  const firstName = params.searchParams?.firstName?.trim() || "";
  const lastName = params.searchParams?.lastName?.trim() || "";
  const email = params.searchParams?.email?.trim() || "";
  const ppsns = params.searchParams?.ppsns?.length
    ? params.searchParams.ppsns.filter((ppsn) => ppsn.trim().length > 0)
    : [];

  if (search.length > 0) {
    whereClauses.push(
      `(
        p.email ILIKE $${nextIndexInQuery} OR
        p.public_name ILIKE $${nextIndexInQuery} OR
        EXISTS (
          SELECT 1 FROM profile_data pde
          WHERE pde.profile_details_id = pd.id
          AND pde.value_type = 'string'
          AND pde.value ILIKE $${nextIndexInQuery}
        )
      )`,
    );
    queryValues.push(`%${search}%`);
    nextIndexInQuery++;
  }

  // Combine all field-specific EXISTS into a single EXISTS with AND logic inside
  const fieldClauses = [];
  if (firstName.length > 0) {
    fieldClauses.push(`(
      p.public_name ILIKE $${nextIndexInQuery} OR
      EXISTS (
      SELECT 1 FROM profile_data pde
      WHERE pde.profile_details_id = pd.id
        AND pde.name = 'firstName'
        AND pde.value_type = 'string'
        AND pde.value ILIKE $${nextIndexInQuery}
    )
    )`);
    queryValues.push(`%${firstName}%`);
    nextIndexInQuery++;
  }
  if (lastName.length > 0) {
    fieldClauses.push(`(
      p.public_name ILIKE $${nextIndexInQuery} OR
       EXISTS (
      SELECT 1 FROM profile_data pde
      WHERE pde.profile_details_id = pd.id
        AND pde.name = 'lastName'
        AND pde.value_type = 'string'
        AND pde.value ILIKE $${nextIndexInQuery}
    )
    )`);
    queryValues.push(`%${lastName}%`);
    nextIndexInQuery++;
  }
  if (email.length > 0) {
    fieldClauses.push(`(
       EXISTS (
      SELECT 1 FROM profile_data pde
      WHERE pde.profile_details_id = pd.id
        AND pde.name = 'email'
        AND pde.value_type = 'string'
        AND pde.value ILIKE $${nextIndexInQuery}
    )
    )`);
    queryValues.push(`%${email}%`);
    nextIndexInQuery++;
  }
  if (ppsns.length > 0) {
    fieldClauses.push(`(
      pde.name = 'ppsn' AND pde.value = ANY($${nextIndexInQuery})
    )`);
    queryValues.push(ppsns);
    nextIndexInQuery++;
  }

  if (fieldClauses.length > 0) {
    whereClauses.push(`EXISTS (
      SELECT 1 FROM profile_data pde
      WHERE pde.profile_details_id = pd.id
        AND ${fieldClauses.join(" AND ")}
    )`);
  }

  const whereClause = whereClauses.length
    ? ` AND ${whereClauses.join(" AND ")} `
    : "";

  return {
    whereClauses: whereClause,
    queryValues,
    nextIndexInQuery,
  };
};
