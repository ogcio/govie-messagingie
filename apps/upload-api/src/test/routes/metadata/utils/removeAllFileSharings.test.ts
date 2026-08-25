import type { PostgresDb } from "@fastify/postgres";
import { describe, expect, it } from "vitest";
import removeAllFileSharings from "../../../../routes/metadata/utils/removeAllFileSharings.js";

describe("removeAllFileSharings", () => {
  it("executes query with correct params", () => {
    const params: string[] = [];
    const pg = { query: (...args: string[]) => params.push(...args) };
    removeAllFileSharings(pg as PostgresDb, "fileId");
    expect(params[1]).toMatchObject(["fileId"]);
  });
});
