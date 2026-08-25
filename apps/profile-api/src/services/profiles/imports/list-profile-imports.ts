import type { Pool } from "pg";
import type { PaginationParams } from "~/schemas/pagination.js";

interface ListProfileImportsParams {
  pool: Pool;
  organisationId: string;
  source?: "csv" | "json";
  search?: string;
  pagination: Required<PaginationParams>;
}

export async function listProfileImports({
  pool,
  organisationId,
  source = "csv",
  search,
  pagination: { offset, limit },
}: ListProfileImportsParams) {
  const conditions = [];
  const countConditions = [];
  const params = [limit, offset];
  const countParams = [];
  let paramIndex = 3;
  let countParamIndex = 1;

  if (search) {
    conditions.push(`metadata->>'filename' ILIKE $${paramIndex}::text`);
    countConditions.push(
      `metadata->>'filename' ILIKE $${countParamIndex}::text`,
    );
    params.push(`%${search}%`);
    countParams.push(`%${search}%`);
    paramIndex++;
    countParamIndex++;
  }

  conditions.push(`organisation_id = $${paramIndex}::text`);
  countConditions.push(`organisation_id = $${countParamIndex}::text`);
  params.push(organisationId);
  countParams.push(organisationId);
  paramIndex++;
  countParamIndex++;

  conditions.push(`source = $${paramIndex}::text`);
  countConditions.push(`source = $${countParamIndex}::text`);
  params.push(source);
  countParams.push(source);

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countWhereClause =
    countConditions.length > 0 ? `WHERE ${countConditions.join(" AND ")}` : "";

  const { rows: data } = await pool.query(
    `
    SELECT 
      id,
      organisation_id as "organisationId",
      status,
      metadata,
      source,
      created_at as "createdAt",
      updated_at as "updatedAt"
    FROM profile_imports
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $1::integer OFFSET $2::integer
    `,
    params,
  );

  const {
    rows: [{ total }],
  } = await pool.query(
    `
    SELECT COUNT(*) as total 
    FROM profile_imports
    ${countWhereClause}
    `,
    countParams,
  );

  return {
    data,
    total: Number(total),
  };
}
