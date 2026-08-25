import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { SupportSearchBody } from "~/schemas/profiles/support.js";
import { createProfile } from "~/services/profiles/sql/create-profile.js";
import { createProfileDataForProfileDetail } from "~/services/profiles/sql/create-profile-data-for-profile-details.js";
import { createProfileDetails } from "~/services/profiles/sql/create-profile-details.js";
import { supportSearch } from "~/services/profiles/support.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const mockLogger: FastifyBaseLogger = {
  debug: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
  level: "info",
  fatal: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
} as unknown as FastifyBaseLogger;

const USER_A_ID = `usra${randomUUID().substring(0, 8)}`;
const USER_B_ID = `usrb${randomUUID().substring(0, 8)}`;
const USER_C_ID = `usrc${randomUUID().substring(0, 8)}`;

const defaultPagination = { offset: "0", limit: "20" };

const search = (
  pool: ReturnType<typeof getPoolFromConnectionString>,
  body: SupportSearchBody,
  pagination = defaultPagination,
) =>
  supportSearch({
    logger: mockLogger,
    pool,
    body,
    pagination,
  });

describe("searchForUsers", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeAll(async () => {
    client = await pool.connect();

    // User A: has null-org and org-1 latest details
    await createProfile(client, {
      id: USER_A_ID,
      primaryUserId: USER_A_ID,
      publicName: "Alice Smith",
      email: "alice@example.com",
    });
    const pdANull = await createProfileDetails(client, USER_A_ID, undefined);
    await createProfileDataForProfileDetail(client, pdANull, {
      email: "alice@example.com",
      ppsn: "1234567A",
      dateOfBirth: "1990-05-15",
      firstName: "Alice",
      lastName: "Smith",
    });
    const pdAOrg1 = await createProfileDetails(client, USER_A_ID, "org-1");
    await createProfileDataForProfileDetail(client, pdAOrg1, {
      email: "alice@work.com",
      ppsn: "1234567A",
      dateOfBirth: "1990-05-15",
      firstName: "Alice",
      lastName: "SmithOrg",
    });

    // User B: only null-org latest detail
    await createProfile(client, {
      id: USER_B_ID,
      primaryUserId: USER_B_ID,
      publicName: "Bob Jones",
      email: "bob@example.com",
    });
    const pdBNull = await createProfileDetails(client, USER_B_ID, undefined);
    await createProfileDataForProfileDetail(client, pdBNull, {
      email: "bob@example.com",
      ppsn: "7654321B",
      dateOfBirth: "1985-10-20",
      firstName: "Bob",
      lastName: "Jones",
    });

    // User C: org-2 latest + a stale is_latest=false record
    await createProfile(client, {
      id: USER_C_ID,
      primaryUserId: USER_C_ID,
      publicName: "Charlie Brown",
      email: "charlie@example.com",
    });
    const pdCOrg2 = await createProfileDetails(client, USER_C_ID, "org-2");
    await createProfileDataForProfileDetail(client, pdCOrg2, {
      email: "charlie@org2.com",
      ppsn: "9999999C",
      dateOfBirth: "1995-01-01",
      firstName: "Charlie",
      lastName: "Brown",
    });
    // Stale record (is_latest = false)
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO profile_details (profile_id, organisation_id, is_latest)
       VALUES ($1, $2, false) RETURNING id`,
      [USER_C_ID, "org-2"],
    );
    const staleId = rows[0].id;
    await createProfileDataForProfileDetail(client, staleId, {
      email: "charlie@old.com",
      ppsn: "9999999C",
      dateOfBirth: "1995-01-01",
      firstName: "Charlie",
      lastName: "OldBrown",
    });
  });

  afterAll(async () => {
    client.release();
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should return all users when no criteria provided", async () => {
    const result = await search(pool, {});
    expect(result.total).toBeGreaterThanOrEqual(3);
    expect(result.data.length).toBeGreaterThanOrEqual(4);
    const ids = [...new Set(result.data.map((r) => r.id))];
    expect(ids.length).toBeGreaterThanOrEqual(3);
    // Our test users must be present
    expect(ids).toContain(USER_A_ID);
    expect(ids).toContain(USER_B_ID);
    expect(ids).toContain(USER_C_ID);
  });

  it("should match by name against public_name (ILIKE)", async () => {
    const result = await search(pool, { name: ["alice"] });
    expect(result.total).toBe(1);
    // User A has 2 org rows
    expect(result.data.length).toBe(2);
    expect(result.data.every((r) => r.id === USER_A_ID)).toBe(true);
  });

  it("should match by name against firstName+lastName concat", async () => {
    const result = await search(pool, { name: ["Smith Alice"] });
    expect(result.total).toBe(1);
    expect(result.data.some((r) => r.id === USER_A_ID)).toBe(true);
  });

  it("should match email on profile_data (row-level)", async () => {
    const result = await search(pool, { email: ["alice@work.com"] });
    // Only the org-1 row has this email
    expect(result.total).toBe(1);
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe(USER_A_ID);
    expect(result.data[0].organisationId).toBe("org-1");
    expect(result.data[0].email).toBe("alice@work.com");
  });

  it("should match by ppsn", async () => {
    const result = await search(pool, { ppsn: ["1234567A"] });
    expect(result.total).toBe(1);
    expect(result.data.every((r) => r.id === USER_A_ID)).toBe(true);
    expect(result.data.every((r) => r.ppsn === "1234567A")).toBe(true);
  });

  it("should match dateOfBirth range (from + to)", async () => {
    const result = await search(pool, {
      dateOfBirth: [{ from: "1989-01-01", to: "1991-01-01" }],
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const ids = result.data.map((r) => r.id);
    expect(ids).toContain(USER_A_ID);
    expect(ids).not.toContain(USER_B_ID);
    expect(ids).not.toContain(USER_C_ID);
  });

  it("should match dateOfBirth (from only)", async () => {
    const result = await search(pool, {
      dateOfBirth: [{ from: "1993-01-01" }],
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const ids = result.data.map((r) => r.id);
    expect(ids).toContain(USER_C_ID);
    expect(ids).not.toContain(USER_A_ID);
    expect(ids).not.toContain(USER_B_ID);
  });

  it("should match dateOfBirth (to only)", async () => {
    const result = await search(pool, {
      dateOfBirth: [{ to: "1986-01-01" }],
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    const ids = result.data.map((r) => r.id);
    expect(ids).toContain(USER_B_ID);
    expect(ids).not.toContain(USER_A_ID);
    expect(ids).not.toContain(USER_C_ID);
  });

  it("should match by id", async () => {
    const result = await search(pool, { id: [USER_B_ID] });
    expect(result.total).toBe(1);
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe(USER_B_ID);
  });

  it("should AND between fields (name + email)", async () => {
    const result = await search(pool, {
      name: ["Alice"],
      email: ["alice@work.com"],
      logicalOperator: "and",
    });
    // Only org-1 row matches both name AND email
    expect(result.data.length).toBe(1);
    expect(result.data[0].organisationId).toBe("org-1");
  });

  it("should OR between fields (name + ppsn)", async () => {
    const result = await search(pool, {
      name: ["Alice"],
      ppsn: ["7654321B"],
      logicalOperator: "or",
    });
    const ids = [...new Set(result.data.map((r) => r.id))];
    expect(ids).toContain(USER_A_ID);
    expect(ids).toContain(USER_B_ID);
  });

  it("should AND within same array", async () => {
    // 'Alice Smith' public_name ILIKEs both '%Alice%' and '%Smith%'
    const result = await search(pool, {
      name: ["Alice", "Smith"],
      logicalOperator: "and",
    });
    expect(result.total).toBe(1);
    expect(result.data.every((r) => r.id === USER_A_ID)).toBe(true);
  });

  it("should OR within same array", async () => {
    const result = await search(pool, {
      name: ["Alice", "Bob"],
      logicalOperator: "or",
    });
    const ids = [...new Set(result.data.map((r) => r.id))];
    expect(ids).toContain(USER_A_ID);
    expect(ids).toContain(USER_B_ID);
  });

  it("should AND within same array with no match", async () => {
    // No single profile matches both 'Alice' AND 'Bob' in name
    const result = await search(pool, {
      name: ["Alice", "Bob"],
      logicalOperator: "and",
    });
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  it("should return empty when no match", async () => {
    const result = await search(pool, { name: ["nonexistent"] });
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  it("should not match is_latest=false records", async () => {
    const result = await search(pool, { email: ["charlie@old.com"] });
    expect(result.total).toBe(0);
    expect(result.data).toHaveLength(0);
  });

  it("should paginate by distinct profiles (limit 1)", async () => {
    // Scope to our 3 test users so other test data doesn't interfere
    const body: SupportSearchBody = {
      id: [USER_A_ID, USER_B_ID, USER_C_ID],
      logicalOperator: "or",
    };
    const page1 = await search(pool, body, { offset: "0", limit: "1" });
    expect(page1.total).toBe(3);
    // First profile may have multiple org rows
    const firstProfileId = page1.data[0].id;
    expect(page1.data.every((r) => r.id === firstProfileId)).toBe(true);

    const page2 = await search(pool, body, { offset: "1", limit: "1" });
    expect(page2.total).toBe(3);
    const secondProfileId = page2.data[0].id;
    expect(secondProfileId).not.toBe(firstProfileId);
    expect(page2.data.every((r) => r.id === secondProfileId)).toBe(true);
  });

  it("should order org-null before other orgs for same user", async () => {
    const result = await search(pool, { name: ["Alice"] });
    const userARows = result.data.filter((r) => r.id === USER_A_ID);
    expect(userARows.length).toBe(2);
    // null org should come first
    expect(userARows[0].organisationId).toBeNull();
    expect(userARows[1].organisationId).toBe("org-1");
  });

  it("should be case insensitive (ILIKE)", async () => {
    const result = await search(pool, { name: ["alice"] });
    expect(result.total).toBe(1);
    expect(result.data.every((r) => r.id === USER_A_ID)).toBe(true);
  });

  it("should return email, ppsn, dateOfBirth from profile_data", async () => {
    const result = await search(pool, { id: [USER_A_ID] });
    const nullOrgRow = result.data.find((r) => r.organisationId === null);
    expect(nullOrgRow).toBeDefined();
    expect(nullOrgRow?.email).toBe("alice@example.com");
    expect(nullOrgRow?.ppsn).toBe("1234567A");
    expect(nullOrgRow?.dateOfBirth).toBe("1990-05-15");

    const org1Row = result.data.find((r) => r.organisationId === "org-1");
    expect(org1Row).toBeDefined();
    expect(org1Row?.email).toBe("alice@work.com");
  });

  it("should return primary user id and should return user with primary_user_id = input id", async () => {
    const childId = `usrc${randomUUID().substring(0, 8)}`;
    await createProfile(client, {
      id: childId,
      primaryUserId: USER_A_ID,
      publicName: "Zorro Child",
      email: "zorro.child@example.com",
    });

    const pdANull = await createProfileDetails(client, childId, "org-child");
    await createProfileDataForProfileDetail(client, pdANull, {
      email: "zorro.child.org@example.com",
      ppsn: "zorro-ppsn",
      dateOfBirth: "1990-05-15",
      firstName: "Child",
      lastName: "Zorro",
    });
    const result = await search(pool, { id: [USER_A_ID] });
    const nullOrgRow = result.data.find((r) => r.organisationId === null);
    expect(nullOrgRow).toBeDefined();
    expect(nullOrgRow?.email).toBe("alice@example.com");
    expect(nullOrgRow?.ppsn).toBe("1234567A");
    expect(nullOrgRow?.dateOfBirth).toBe("1990-05-15");

    const org1Row = result.data.find((r) => r.organisationId === "org-1");
    expect(org1Row).toBeDefined();
    expect(org1Row?.email).toBe("alice@work.com");

    const childRow = result.data.find((r) => r.organisationId === "org-child");
    expect(childRow).toBeDefined();
    expect(childRow?.email).toBe("zorro.child.org@example.com");
    expect(childRow?.primaryUserId).toBe(USER_A_ID);
    expect(childRow?.id).toBe(childId);
    expect(childRow?.consentStatuses).toBeDefined();
    expect(childRow?.preferredLanguage).toBeDefined();
    expect(childRow?.status).toBeDefined();
    expect(childRow?.safeLevel).toBeDefined();
    expect(childRow?.updatedAt).toBeDefined();
    expect(childRow?.createdAt).toBeDefined();
    expect(childRow?.deletedAt).toBeNull();
    expect(childRow?.ppsn).toBeDefined();
    expect(childRow?.dateOfBirth).toBeDefined();
    expect(childRow?.publicName).toBe("Zorro Child");
    expect(childRow?.organisationId).toBe("org-child");
    expect(childRow?.consentStatuses).toBeDefined();
    expect(childRow?.firstName).toBe("Child");
    expect(childRow?.lastName).toBe("Zorro");
  });
});
