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

  it("should return a suffixed filename when the name clashes", async () => {
    // First lookup (input name) clashes, second (random-suffixed) is free.
    const results = [{ rows: [{ fileName: "filename.txt" }] }, { rows: [] }];
    const pg = { query: () => Promise.resolve(results.shift()) };

    const value = await getFilename(
      pg as unknown as fastifyPostgres.PostgresDb,
      "filename.txt",
      "userId",
    );

    expect(value).toMatch(/^filename-[0-9a-z]+\.txt$/);
    expect(value).not.toBe("filename.txt");
  });

  it("should retry until a non-clashing filename is found", async () => {
    const results = [
      { rows: [{ fileName: "filename.txt" }] },
      { rows: [{ fileName: "clash-again" }] },
      { rows: [] },
    ];
    const pg = { query: () => Promise.resolve(results.shift()) };

    const value = await getFilename(
      pg as unknown as fastifyPostgres.PostgresDb,
      "filename.txt",
      "userId",
    );

    expect(value).toMatch(/^filename-[0-9a-z]+\.txt$/);
  });
});
