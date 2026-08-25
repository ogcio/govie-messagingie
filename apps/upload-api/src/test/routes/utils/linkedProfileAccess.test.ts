import type { PostgresDb } from "@fastify/postgres";
import { httpErrors } from "@fastify/sensible";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Linked-profile (parent-child) access is derived at read time via
// PersonalProfileSdkWrapper.getLinkedProfileIds. These tests lock in the
// confirmed directionality: a PARENT can reach a file shared with a linked
// CHILD, an UNLINKED user cannot, and a CHILD cannot reach a parent-only file
// (the expansion is downward only).
const getLinkedProfileIds = vi.fn<(id: string) => Promise<string[]>>();

vi.mock("../../../utils/personal-profile-sdk-wrapper.js", () => ({
  PersonalProfileSdkWrapper: class {
    getLinkedProfileIds = getLinkedProfileIds;
  },
}));

import userCanAccessFileOrThrow from "../../../routes/utils/userCanAccessFileOrThrow.js";
import { userCanAccessMultipleFilesOrThrow } from "../../../routes/utils/userCanAccessMultipleFilesOrThrow.js";

type Share = { fileId: string; userId: string };

const fakeLogger = {} as FastifyRequest["log"];

/**
 * Fake `pg` for {@link userCanAccessFileOrThrow}: answers the three raw queries
 * (org-owned, shared-with-user, shared-with-linked) from an in-memory share
 * set. Org ownership is intentionally empty for these citizen-linking cases.
 */
function makeSingleFilePg(shares: Share[]): PostgresDb {
  return {
    query: async (text: string, params: unknown[]) => {
      if (text.includes("organization_id")) {
        return { rowCount: 0, rows: [] };
      }
      if (text.includes("ANY($2)")) {
        const [fileId, userIds] = params as [string, string[]];
        const match = shares.some(
          (s) => s.fileId === fileId && userIds.includes(s.userId),
        );
        return { rowCount: match ? 1 : 0, rows: match ? [{}] : [] };
      }
      const [fileId, userId] = params as [string, string];
      const match = shares.some(
        (s) => s.fileId === fileId && s.userId === userId,
      );
      return { rowCount: match ? 1 : 0, rows: match ? [{}] : [] };
    },
  } as unknown as PostgresDb;
}

/** Fake `pg.connect()` client for {@link userCanAccessMultipleFilesOrThrow}. */
function makeMultiFilePg(shares: Share[]): PostgresDb {
  return {
    connect: async () => ({
      query: async (text: string, params: unknown[]) => {
        if (text.includes("files_users")) {
          const [fileIds] = params as [string[]];
          const rows = shares
            .filter((s) => fileIds.includes(s.fileId))
            .map((s) => ({ file_id: s.fileId, user_id: s.userId }));
          return { rows };
        }
        return { rows: [] };
      },
      release: () => {},
    }),
  } as unknown as PostgresDb;
}

beforeEach(() => {
  getLinkedProfileIds.mockReset();
});

describe("userCanAccessFileOrThrow - linked profiles", () => {
  const buildAppWithPg = (shares: Share[]) =>
    ({
      httpErrors,
      pg: makeSingleFilePg(shares),
    }) as unknown as FastifyInstance;

  it("POSITIVE: a file shared with a linked CHILD is accessible to the PARENT", async () => {
    getLinkedProfileIds.mockResolvedValue(["child"]);
    const request = {
      userData: { userId: "parent", accessToken: "t" },
      log: fakeLogger,
    } as unknown as FastifyRequest;

    await expect(
      userCanAccessFileOrThrow(
        buildAppWithPg([{ fileId: "F", userId: "child" }]),
        request,
        "F",
      ),
    ).resolves.toBeUndefined();
    expect(getLinkedProfileIds).toHaveBeenCalledWith("parent");
  });

  it("NEGATIVE: an unrelated user is denied", async () => {
    getLinkedProfileIds.mockResolvedValue([]);
    const request = {
      userData: { userId: "stranger", accessToken: "t" },
      log: fakeLogger,
    } as unknown as FastifyRequest;

    await expect(
      userCanAccessFileOrThrow(
        buildAppWithPg([{ fileId: "F", userId: "child" }]),
        request,
        "F",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("NEGATIVE (downward-only): a child cannot access a parent-only file", async () => {
    // A child has no linked profiles of its own (expansion is downward).
    getLinkedProfileIds.mockResolvedValue([]);
    const request = {
      userData: { userId: "child", accessToken: "t" },
      log: fakeLogger,
    } as unknown as FastifyRequest;

    await expect(
      userCanAccessFileOrThrow(
        buildAppWithPg([{ fileId: "F", userId: "parent" }]),
        request,
        "F",
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("userCanAccessMultipleFilesOrThrow - linked profiles", () => {
  it("POSITIVE: a file shared with a linked CHILD is accessible to the PARENT", async () => {
    getLinkedProfileIds.mockResolvedValue(["child"]);

    await expect(
      userCanAccessMultipleFilesOrThrow({
        pg: makeMultiFilePg([{ fileId: "F", userId: "child" }]),
        userToCheck: "parent",
        userData: { userId: "parent", accessToken: "t" },
        logger: fakeLogger,
        fileIds: ["F"],
      }),
    ).resolves.toBeUndefined();
    expect(getLinkedProfileIds).toHaveBeenCalledWith("parent");
  });

  it("NEGATIVE: an unrelated user is denied", async () => {
    getLinkedProfileIds.mockResolvedValue([]);

    await expect(
      userCanAccessMultipleFilesOrThrow({
        pg: makeMultiFilePg([{ fileId: "F", userId: "child" }]),
        userToCheck: "stranger",
        userData: { userId: "stranger", accessToken: "t" },
        logger: fakeLogger,
        fileIds: ["F"],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("NEGATIVE (downward-only): a child cannot access a parent-only file", async () => {
    getLinkedProfileIds.mockResolvedValue([]);

    await expect(
      userCanAccessMultipleFilesOrThrow({
        pg: makeMultiFilePg([{ fileId: "F", userId: "parent" }]),
        userToCheck: "child",
        userData: { userId: "child", accessToken: "t" },
        logger: fakeLogger,
        fileIds: ["F"],
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
