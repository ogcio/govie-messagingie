import type { FastifyBaseLogger } from "fastify";
import type { Pool } from "pg";
import type {
  ConsentStatus,
  ConsentSubject,
} from "~/schemas/consents/shared.js";
import type { PaginationParams } from "~/schemas/pagination.js";
import type {
  SupportSearchBody,
  SupportSearchResponse,
} from "~/schemas/profiles/support.js";
import { withClient } from "~/utils/with-client.js";
import { buildSupportSearchQueries } from "./sql/build-support-search-queries.js";

export async function supportSearch(params: {
  logger: FastifyBaseLogger;
  pool: Pool;
  body: SupportSearchBody;
  pagination: Required<PaginationParams>;
}): Promise<{ data: SupportSearchResponse; total: number }> {
  const { pool, body, pagination } = params;

  return withClient(pool, async (client) => {
    const queries = buildSupportSearchQueries({ body, pagination });

    const countResult = await client.query<{ count: string }>(
      queries.count.query,
      queries.count.values,
    );

    const total = Number(countResult.rows[0]?.count ?? 0);
    if (total === 0) {
      return { data: [], total: 0 };
    }

    const rows = await client.query<{
      id: string;
      publicName: string;
      organisationId: string | null;
      profileDetailsId: string;
      primaryUserId: string;
      createdAt: string;
      updatedAt: string;
      deletedAt: string | null;
      preferredLanguage: string;
      safeLevel: number;
      status: string;
      consentStatuses: Record<
        ConsentSubject,
        {
          status: ConsentStatus;
          consent_statement_id: string;
        }
      >;
    }>(queries.data.query, queries.data.values);

    if (rows.rows.length === 0) {
      return { data: [], total };
    }

    const profileDetailsIds = rows.rows.map((r) => r.profileDetailsId);

    const profileDataResult = await client.query<{
      profileDetailsId: string;
      name: string;
      value: string;
    }>(
      `SELECT
        pdata.profile_details_id AS "profileDetailsId",
        pdata.name,
        pdata.value
      FROM profile_data pdata
      WHERE pdata.profile_details_id = ANY($1)
        AND pdata.name IN ('email', 'ppsn', 'dateOfBirth', 'firstName', 'lastName')`,
      [profileDetailsIds],
    );

    const dataMap: Record<
      string,
      {
        email?: string;
        ppsn?: string;
        dateOfBirth?: string;
        firstName?: string;
        lastName?: string;
      }
    > = {};
    for (const row of profileDataResult.rows) {
      if (!dataMap[row.profileDetailsId]) {
        dataMap[row.profileDetailsId] = {};
      }
      dataMap[row.profileDetailsId][
        row.name as "email" | "ppsn" | "dateOfBirth" | "firstName" | "lastName"
      ] = row.value;
    }

    const data: SupportSearchResponse = rows.rows.map((row) => ({
      id: row.id,
      publicName: row.publicName,
      email: dataMap[row.profileDetailsId]?.email ?? "",
      organisationId: row.organisationId,
      ppsn: dataMap[row.profileDetailsId]?.ppsn ?? null,
      dateOfBirth: dataMap[row.profileDetailsId]?.dateOfBirth ?? null,
      firstName: dataMap[row.profileDetailsId]?.firstName ?? null,
      lastName: dataMap[row.profileDetailsId]?.lastName ?? null,
      primaryUserId: row.primaryUserId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      deletedAt: row.deletedAt,
      consentStatuses: row.consentStatuses ?? {},
      preferredLanguage: row.preferredLanguage,
      status: row.status,
      safeLevel: row.safeLevel ? Number(row.safeLevel) : 0,
    }));

    return { data, total };
  });
}
