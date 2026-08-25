import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { ImportStatuses } from "~/const/profile.js";
import { checkProfileImportCompletion } from "~/services/profiles/sql/check-profile-import-completion.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import { createProfileImportDetails } from "~/services/profiles/sql/create-profile-import-details.js";
import { updateProfileImportDetailsStatus } from "~/services/profiles/sql/update-profile-import-details-status.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";

const getMockProfileDetailsToInsert = () => [
  { email: "first@mail.com", firstName: "First", lastName: "Mail" },
  { email: "second@mail.com", firstName: "Second", lastName: "Mail" },
  { email: "third@mail.com", firstName: "Third", lastName: "Mail" },
];

describe("checkProfileImportCompletion", async () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeEach(async () => {
    client = await pool.connect();
  });

  afterEach(() => {
    if (client) {
      client.release();
    }
  });

  afterAll(async () => {
    if (!pool.ended) {
      await pool.end();
    }
  });

  it("should return not complete when there are pending profiles", async () => {
    const orgId = `pending-profiles-${randomUUID().substring(0, 5)}`;
    const created = await createProfileImport(client, orgId);
    const details = await createProfileImportDetails(
      client,
      created.profileImportId,
      getMockProfileDetailsToInsert(),
    );
    const statuses = ["completed", "failed", "pending"];
    for (let i = 0; i < 3; i++) {
      await updateProfileImportDetailsStatus(client, [details[i]], statuses[i]);
    }

    const result = await checkProfileImportCompletion(
      client,
      created.profileImportId,
    );

    expect(result).toEqual({
      isComplete: false,
      finalStatus: ImportStatuses.PROCESSING,
    });
  });

  it("should return complete and successful when all profiles completed", async () => {
    const orgId = `pending-profiles-${randomUUID().substring(0, 5)}`;
    const created = await createProfileImport(client, orgId);
    const details = await createProfileImportDetails(
      client,
      created.profileImportId,
      getMockProfileDetailsToInsert(),
    );
    const status = "completed";
    for (let i = 0; i < 3; i++) {
      await updateProfileImportDetailsStatus(client, [details[i]], status);
    }

    const result = await checkProfileImportCompletion(
      client,
      created.profileImportId,
    );

    expect(result).toEqual({
      isComplete: true,
      finalStatus: ImportStatuses.COMPLETED,
    });
  });

  it("should return complete and failed when all profiles failed", async () => {
    const orgId = `pending-profiles-${randomUUID().substring(0, 5)}`;
    const created = await createProfileImport(client, orgId);
    const details = await createProfileImportDetails(
      client,
      created.profileImportId,
      getMockProfileDetailsToInsert(),
    );
    const status = "failed";
    for (let i = 0; i < 3; i++) {
      await updateProfileImportDetailsStatus(client, [details[i]], status);
    }

    const result = await checkProfileImportCompletion(
      client,
      created.profileImportId,
    );

    expect(result).toEqual({
      isComplete: true,
      finalStatus: ImportStatuses.FAILED,
    });
  });

  it("should return complete with mixed success/failure", async () => {
    const orgId = `pending-profiles-${randomUUID().substring(0, 5)}`;
    const created = await createProfileImport(client, orgId);
    const details = await createProfileImportDetails(
      client,
      created.profileImportId,
      getMockProfileDetailsToInsert(),
    );
    const statuses = ["completed", "failed", "failed"];
    for (let i = 0; i < 3; i++) {
      await updateProfileImportDetailsStatus(client, [details[i]], statuses[i]);
    }

    const result = await checkProfileImportCompletion(
      client,
      created.profileImportId,
    );

    expect(result).toEqual({
      isComplete: true,
      finalStatus: ImportStatuses.COMPLETED,
    });
  });

  it("should handle empty import (0 profiles)", async () => {
    const orgId = `pending-profiles-${randomUUID().substring(0, 5)}`;
    const created = await createProfileImport(client, orgId);

    const result = await checkProfileImportCompletion(
      client,
      created.profileImportId,
    );

    expect(result).toEqual({
      isComplete: true,
      finalStatus: ImportStatuses.COMPLETED,
    });
  });
});
