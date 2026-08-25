import type { PostgresDb } from "@fastify/postgres";
import { describe, expect, it } from "vitest";
import getFileSharings from "../../../../routes/permissions/utils/getFileSharings.js";

describe("getFileSharings", () => {
  it("executes query with correct params", () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    getFileSharings(pg as PostgresDb, "fileId");
    expect(params[1]).toMatchObject(["fileId"]);
  });
});
