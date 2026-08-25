import type fastifyPostgres from "@fastify/postgres";
import { describe, expect, it } from "vitest";
import getFilename from "../../../../routes/files/utils/getFilename.js";

describe("getFilename", () => {
  it("should return the provided filename when there is no clash", async () => {
    const pg = { query: () => Promise.resolve({ rows: [] }) };

    let value = await getFilename(
      pg as unknown as fastifyPostgres.PostgresDb,
      "filename.txt",
      "userId",
    );

    expect(value).toBe("filename.txt");

    value = await getFilename(
      pg as unknown as fastifyPostgres.PostgresDb,
      "filename.prd.txt",
      "userId",
    );

    expect(value).toBe("filename.prd.txt");
  });
});
