import type { PostgresDb } from "@fastify/postgres";
import type { Pool, PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getExpiredFiles,
  getOrganizationFiles,
  getSharedFiles,
  markFilesAsDeleted,
  scheduleExpiredFilesForDeletion,
  scheduleFileForDeletion,
} from "../../../../routes/metadata/utils/filesMetadata.js";

// Mock the PoolClient query method
class MockPoolClient {
  constructor() {
    this.query = this.query.bind(this);
  }

  async query(queryText: string, params: string[]) {
    // Mock response based on queryText and params
    if (queryText.includes("WHERE owner = $1")) {
      // Mock response for getOwnedFiles
      return {
        rows: [
          {
            id: "1",
            key: "file1.txt",
            ownerId: params[0],
            fileSize: 1234,
            mimeType: "text/plain",
            createdAt: new Date(),
            lastScan: new Date(),
            infected: false,
            infectionDescription: null,
            deleted: false,
            fileName: "file1.txt",
          },
        ],
      };
    } else if (queryText.includes("WHERE organization_id = $1")) {
      // Mock response for getOrganizationFiles
      return {
        rows: [
          {
            id: "2",
            key: "file2.txt",
            ownerId: "user2",
            fileSize: 2345,
            mimeType: "text/plain",
            createdAt: new Date(),
            lastScan: new Date(),
            infected: false,
            infectionDescription: null,
            deleted: false,
            fileName: "file2.txt",
          },
        ],
      };
    }
  }
}

describe("filesMetadata", () => {
  it("getOrganizationFiles should return files for a given organization excluding specified IDs", async () => {
    const mockClient = new MockPoolClient();
    const organizationId = "org1";
    const toExclude = ["3", "4"];

    const result = await getOrganizationFiles({
      client: mockClient as PoolClient,
      organizationId,
      toExclude,
    });

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].id).toBe("2");
    expect(toExclude.includes(result.rows[0].id as string)).toBe(false);
  });

  it("getOrganizationFiles should return files for a given organization without exclusions", async () => {
    const mockClient = new MockPoolClient();
    const organizationId = "org1";
    const toExclude: string[] = [];

    const result = await getOrganizationFiles({
      client: mockClient as PoolClient,
      organizationId,
      toExclude,
    });

    expect(result.rows.length).toBe(1);
    expect(result.rows[0].id).toBe("2");
  });

  it("getSharedFiles should execute a query with userId and no exclusions", () => {
    const params: string[] = [];
    const client = { query: (...args: string[]) => params.push(...args) };

    const toExclude: string[] = [];

    getSharedFiles({
      client: client as PoolClient,
      userId: "userId",
      toExclude,
    });

    expect(params[1]).toMatchObject(["userId"]);
  });

  it("getSharedFiles should execute a query with userId and ids to exclude", () => {
    const params: string[] = [];
    const client = { query: (...args: string[]) => params.push(...args) };

    const toExclude: string[] = ["file-1", "file-2"];

    getSharedFiles({
      client: client as PoolClient,
      userId: "userId",
      toExclude,
    });

    expect(params[1]).toMatchObject(["userId", "file-1", "file-2"]);
  });

  it("getExpiredFiles should execute a query with the correct parameters", () => {
    const params: string[] = [];
    const pool = { query: (...args: string[]) => params.push(...args) };

    const expirationDate = new Date(Date.UTC(2024, 0, 0, 0, 0, 0));

    getExpiredFiles(pool as Pool, expirationDate);

    expect(params[1]).toMatchObject([expirationDate]);
  });

  it("markFilesAsDeleted should execute a query with the correct parameters", () => {
    const params: string[] = [];
    const pool = { query: (...args: string[]) => params.push(...args) };

    const ids = ["id-1", "id-2"];

    markFilesAsDeleted(pool as Pool, ids);

    expect(params[1]).toMatchObject([ids]);
  });

  describe("Schedule file deletion", () => {
    const OriginalDate = Date;

    beforeAll(() => {
      global.Date = class extends OriginalDate {
        constructor() {
          super(OriginalDate.UTC(2024, 0, 5, 0, 0, 0));
        }
      } as DateConstructor;
    });

    afterAll(() => {
      global.Date = OriginalDate;
    });

    it("scheduleExpiredFilesForDeletion should execute a query with the correct parameters", () => {
      const params: string[] = [];
      const pool = { query: (...args: string[]) => params.push(...args) };

      scheduleExpiredFilesForDeletion(pool as Pool);

      expect(params[1][0].toString()).toBe(
        new OriginalDate(OriginalDate.UTC(2024, 1, 4, 0, 0, 0)).toString(),
      );
    });

    it("scheduleFileForDeletion should execute a query with the correct params", () => {
      const params: string[] = [];
      const pg = {
        query: (...args: string[]) => params.push(...args),
      };

      scheduleFileForDeletion(pg as PostgresDb, "fileId");
      expect(params[1][0]).toBe("fileId");
      expect(params[1][1].toString()).toBe(
        new OriginalDate(OriginalDate.UTC(2024, 1, 4, 0, 0, 0)).toString(),
      );
    });
  });
});
