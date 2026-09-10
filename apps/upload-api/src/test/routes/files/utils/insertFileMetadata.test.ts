import type fastifyPostgres from "@fastify/postgres";
import { describe, expect, it, vi } from "vitest";
import insertFileMetadata from "../../../../routes/files/utils/insertFileMetadata.js";
import type { FileMetadataType } from "../../../../types/schemaDefinitions.js";

const baseMetadata: FileMetadataType = {
  id: "file-id",
  fileName: "file.txt",
  createdAt: new Date("2024-01-01T00:00:00Z"),
  fileSize: 100,
  infectionDescription: undefined,
  key: "user/file.txt",
  lastScan: new Date("2024-01-01T00:00:00Z"),
  deleted: false,
  mimeType: "text/plain",
  infected: false,
  ownerId: "owner-id",
  antivirusDbVersion: "27364",
  organizationId: "org-id",
} as unknown as FileMetadataType;

const buildPg = () => {
  const query = vi.fn().mockResolvedValue({ rows: [] });
  return {
    pg: { query } as unknown as fastifyPostgres.PostgresDb,
    query,
  };
};

describe("insertFileMetadata", () => {
  it("inserts base metadata with 13 parameters", async () => {
    const { pg, query } = buildPg();

    await insertFileMetadata(pg, baseMetadata);

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("INSERT INTO files");
    expect(sql).not.toContain("expires_at");
    expect(sql).not.toContain("external_id");
    expect(values).toHaveLength(13);
    expect(values[0]).toBe("file-id");
    expect(values[2]).toBe("owner-id");
  });

  it("adds expires_at column when expiresAt is set", async () => {
    const { pg, query } = buildPg();
    const expiresAt = new Date("2030-01-01T00:00:00Z");

    await insertFileMetadata(pg, { ...baseMetadata, expiresAt });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("expires_at");
    expect(sql).toContain("$14");
    expect(sql).not.toContain("external_id");
    expect(values).toHaveLength(14);
    expect(values[13]).toBe(expiresAt);
  });

  it("adds external_id column when externalId is set", async () => {
    const { pg, query } = buildPg();

    await insertFileMetadata(pg, { ...baseMetadata, externalId: "ext-1" });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("external_id");
    expect(sql).toContain("$14");
    expect(sql).not.toContain("expires_at");
    expect(values).toHaveLength(14);
    expect(values[13]).toBe("ext-1");
  });

  it("adds both expires_at and external_id when both are set", async () => {
    const { pg, query } = buildPg();
    const expiresAt = new Date("2030-01-01T00:00:00Z");

    await insertFileMetadata(pg, {
      ...baseMetadata,
      expiresAt,
      externalId: "ext-1",
    });

    const [sql, values] = query.mock.calls[0];
    expect(sql).toContain("expires_at, external_id");
    expect(sql).toContain("$14, $15");
    expect(values).toHaveLength(15);
    expect(values[13]).toBe(expiresAt);
    expect(values[14]).toBe("ext-1");
  });
});
