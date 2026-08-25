import type { PostgresDb } from "@fastify/postgres";
import { describe, expect, it } from "vitest";
import removeFileSharing from "../../../../routes/permissions/utils/removeFileSharing.js";

describe("removeFileSharing", () => {
  it("executes query with correct params", () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    removeFileSharing(pg as PostgresDb, "fileId", "userId");
    expect(params[1]).toMatchObject(["fileId", "userId"]);
  });
});
