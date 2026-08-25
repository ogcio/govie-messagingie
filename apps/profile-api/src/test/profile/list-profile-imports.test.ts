import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { listProfileImports } from "~/services/profiles/imports/list-profile-imports.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const defaultPagination = { offset: "0", limit: "10" };

function createImport({
  id = randomUUID(),
  organisationId = "orgid",
  source = "csv",
  filename = "test.csv",
  status = ImportStatuses.PROCESSING,
  createdAt = new Date(),
} = {}) {
  return pool.query(
    `INSERT INTO profile_imports (id, organisation_id, source, metadata, status, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      organisationId,
      source,
      JSON.stringify({ filename }),
      status,
      createdAt,
    ],
  );
}

describe("listProfileImports", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("should list profile imports with default source (csv)", async () => {
    await createImport({ source: "csv" });
    const result = await listProfileImports({
      pool,
      organisationId: "orgid",
      pagination: defaultPagination,
    });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].source).toBe("csv");
  });

  it("should list profile imports filtered by source", async () => {
    await createImport({ source: "json" });
    const result = await listProfileImports({
      pool,
      source: "json",
      organisationId: "orgid",
      pagination: defaultPagination,
    });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].source).toBe("json");
  });

  it("should list profile imports filtered by organisation", async () => {
    const organisationId = "org-1";
    await createImport({ organisationId });
    const result = await listProfileImports({
      pool,
      organisationId,
      pagination: defaultPagination,
    });

    expect(result.data).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.data[0].organisationId).toBe(organisationId);
  });

  it("should handle pagination correctly", async () => {
    for (let i = 0; i < 15; i++) {
      await createImport({ filename: `file-pagination${i}.csv` });
    }
    const pagination = { offset: "10", limit: "5" };
    const result = await listProfileImports({
      pool,
      pagination,
      search: "file-pagination",
      organisationId: "orgid",
    });
    expect(result.data.length).toBeLessThanOrEqual(5);
    expect(result.total).toBe(15);
  });

  it("should handle empty results", async () => {
    const result = await listProfileImports({
      pool,
      pagination: defaultPagination,
      organisationId: "orgId",
    });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("should filter by search term", async () => {
    await createImport({ filename: "test-filter-1.csv" });
    await createImport({ filename: "test-filter-2.csv" });
    await createImport({ filename: "other.csv" });
    const result = await listProfileImports({
      pool,
      organisationId: "orgid",
      search: "test-filter",
      pagination: defaultPagination,
    });

    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(
      result.data.every((i) =>
        i.metadata.filename.toLowerCase().includes("test"),
      ),
    ).toBe(true);
  });

  it("should return empty results when search term doesn't match", async () => {
    await createImport({ filename: "file.csv" });
    const result = await listProfileImports({
      pool,
      organisationId: "orgid",
      search: "non-existent",
      pagination: defaultPagination,
    });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
