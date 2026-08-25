import type { PoolClient } from "pg";
import type { DetailType } from "~/schemas/profiles/model.js";
import { isISODate } from "~/utils/dates.js";

const getValueType = (value: unknown): DetailType => {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && isISODate(value)) return "date";
  return "string";
};

export const createProfileDataForProfileDetail = async (
  client: PoolClient,
  profileDetailId: string,
  data: Record<string, string | number | boolean | Date>,
): Promise<void> => {
  const entries = Object.entries(data);

  if (entries.length === 0) {
    return;
  }

  const values = entries
    .map((_, index) => {
      const baseIndex = index * 3 + 2; // Start from $2 since $1 is profileDetailId
      return `($1, $${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2})`;
    })
    .join(",");

  const params = [profileDetailId];
  for (const [key, value] of entries) {
    params.push(
      key, // name
      getValueType(value), // value_type
      value.toString(), // value
    );
  }

  const query = `
    INSERT INTO profile_data (
      profile_details_id,
      name,
      value_type,
      value
    ) VALUES ${values}
  `;

  await client.query(query, params);
};

export const createProfileDataForProfileDetailsBulk = async (
  client: PoolClient,
  profileDetailIds: string[],
  dataList: Record<string, string | number | boolean | Date>[],
): Promise<void> => {
  if (profileDetailIds.length === 0) {
    return;
  }

  const BATCH_SIZE = 1000; // Limit to prevent hitting PostgreSQL parameter limit
  const values = [];
  const params = [];
  let paramIndex = 1;

  for (let i = 0; i < profileDetailIds.length; i++) {
    const profileDetailId = profileDetailIds[i];
    const data = dataList[i];
    const entries = Object.entries(data);

    for (const [key, value] of entries) {
      const baseIndex = paramIndex;
      values.push(
        `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3})`,
      );
      params.push(profileDetailId, key, getValueType(value), value.toString());
      paramIndex += 4;

      // Check if we need to execute a batch
      if (values.length >= BATCH_SIZE) {
        await executeBatch(client, values, params);
        values.length = 0;
        params.length = 0;
        paramIndex = 1;
      }
    }
  }

  if (values.length > 0) {
    await executeBatch(client, values, params);
  }
};

async function executeBatch(
  client: PoolClient,
  values: string[],
  params: (string | number | boolean)[],
): Promise<void> {
  if (values.length === 0) return;

  const query = `
    INSERT INTO profile_data (
      profile_details_id,
      name,
      value_type,
      value
    ) VALUES ${values.join(",")}
  `;

  await client.query(query, params);
}
