import type { PostgresDb } from "@fastify/postgres";
import { describe, expect, it } from "vitest";
import addFileSharing from "../../../../routes/permissions/utils/addFileSharing.js";

describe("addFileSharing", () => {
  it("executes query with correct params - single userId", async () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    await addFileSharing(pg as PostgresDb, {
      fileId: "fileId",
      userId: "userId",
    });
    expect(params[1]).toMatchObject(["fileId", ["userId"]]);
  });

  it("executes query with correct params - multiple userIds", async () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    await addFileSharing(pg as PostgresDb, {
      fileId: "fileId",
      userIds: ["userId1", "userId2"],
    });
    expect(params[1]).toMatchObject(["fileId", ["userId1", "userId2"]]);
  });

  it("maps query rejections to an internal server error", async () => {
    const pg = { query: () => Promise.reject(new Error("query failed")) };

    await expect(
      addFileSharing(pg as PostgresDb, {
        fileId: "fileId",
        userId: "userId",
      }),
    ).rejects.toMatchObject({
      statusCode: 500,
      message: "Internal server error adding permissions",
    });
  });
});
