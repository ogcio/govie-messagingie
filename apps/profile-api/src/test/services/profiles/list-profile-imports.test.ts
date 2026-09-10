import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listProfileImports } from "~/services/profiles/imports/list-profile-imports.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
const pagination = { limit: "10", offset: "0" };

describe("listProfileImports", () => {
  const organisationId = `org-imports-${randomUUID().substring(0, 8)}`;

  beforeAll(async () => {
    const client = await pool.connect();
    try {
      await createProfileImport(client, organisationId, "csv", {
        filename: "employees.csv",
        mimetype: "text/csv",
        size: 10,
      });
      await createProfileImport(client, organisationId, "csv", {
        filename: "contractors.csv",
        mimetype: "text/csv",
        size: 20,
      });
      await createProfileImport(client, organisationId, "json");
    } finally {
      client.release();
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("lists csv imports for the organisation by default", async () => {
    const result = await listProfileImports({
      pool,
      organisationId,
      pagination,
    });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(2);
    for (const item of result.data) {
      expect(item.organisationId).toBe(organisationId);
      expect(item.source).toBe("csv");
    }
  });

  it("filters by source", async () => {
    const result = await listProfileImports({
      pool,
      organisationId,
      source: "json",
      pagination,
    });
    expect(result.total).toBe(1);
    expect(result.data[0].source).toBe("json");
  });

  it("filters by filename search", async () => {
    const result = await listProfileImports({
      pool,
      organisationId,
      search: "employees",
      pagination,
    });
    expect(result.total).toBe(1);
    expect(result.data[0].metadata.filename).toBe("employees.csv");
  });

  it("returns empty results for a non-matching search", async () => {
    const result = await listProfileImports({
      pool,
      organisationId,
      search: "does-not-exist",
      pagination,
    });
    expect(result.total).toBe(0);
    expect(result.data).toEqual([]);
  });

  it("respects pagination limits", async () => {
    const result = await listProfileImports({
      pool,
      organisationId,
      pagination: { limit: "1", offset: "0" },
    });
    expect(result.total).toBe(2);
    expect(result.data).toHaveLength(1);
  });
});
