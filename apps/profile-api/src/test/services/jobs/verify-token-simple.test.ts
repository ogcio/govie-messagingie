import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyToken } from "~/services/jobs/verify-token.js";
import { createProfileImport } from "~/services/profiles/sql/create-profile-import.js";
import {
  DATABASE_TEST_URL_KEY,
  getPoolFromConnectionString,
} from "~/test/build-testcontainer-pg.js";
import { mockLogger } from "~/test/fixtures/common.js";

describe("verifyToken - Simple Tests", () => {
  const pool = getPoolFromConnectionString(process.env[DATABASE_TEST_URL_KEY]);
  let client: PoolClient;

  beforeAll(async () => {
    client = await pool.connect();
  });

  afterAll(async () => {
    client.release();
    if (!pool.ended) {
      await pool.end();
    }
  });

  describe("Basic token verification", () => {
    it("should return true for valid job token", async () => {
      // Create a profile import
      const { profileImportId, jobToken } = await createProfileImport(
        client,
        randomUUID().substring(0, 11),
        "csv",
      );

      const result = await verifyToken({
        pool,
        logger: mockLogger,
        profileImportId,
        token: jobToken,
      });

      expect(result).toBe(true);
    });

    it("should return false for invalid job token", async () => {
      // Create a profile import
      const { profileImportId } = await createProfileImport(
        client,
        randomUUID().substring(0, 11),
        "csv",
      );

      const invalidToken = randomUUID();

      const result = await verifyToken({
        pool,
        logger: mockLogger,
        profileImportId,
        token: invalidToken,
      });

      expect(result).toBe(false);
    });

    it("should return false when profile import not found", async () => {
      const nonExistentProfileImportId = randomUUID();
      const token = randomUUID();

      const result = await verifyToken({
        pool,
        logger: mockLogger,
        profileImportId: nonExistentProfileImportId,
        token,
      });

      expect(result).toBe(false);
    });
  });
});
