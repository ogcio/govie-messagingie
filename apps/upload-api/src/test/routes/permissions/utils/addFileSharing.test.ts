import type { PostgresDb } from "@fastify/postgres";
import { describe, expect, it } from "vitest";
import addFileSharing from "../../../../routes/permissions/utils/addFileSharing.js";

describe("addFileSharing", () => {
  it("executes query with correct params - single userId", () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    addFileSharing(pg as PostgresDb, { fileId: "fileId", userId: "userId" });
    expect(params[1]).toMatchObject(["fileId", ["userId"]]);
  });

  it("executes query with correct params - multiple userIds", () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    addFileSharing(pg as PostgresDb, {
      fileId: "fileId",
      userIds: ["userId1", "userId2"],
    });
    expect(params[1]).toMatchObject(["fileId", ["userId1", "userId2"]]);
  });
});
