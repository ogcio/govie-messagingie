import { Writable } from "node:stream";
import type {
  Messaging,
  Upload,
} from "@ogcio/building-blocks-sdk/dist/types/index.js";
import { ZipArchive } from "archiver";
import { describe, expect, it, vi } from "vitest";
import { downloadAndZipFiles } from "~/scripts/lifecycle-worker/steps/export-user-data/files.js";
import {
  getAttachmentFileIdsByUserId,
  getMessagesForUsers,
} from "~/scripts/lifecycle-worker/steps/export-user-data/messages.js";
import { getProfileIdsToExport } from "~/scripts/lifecycle-worker/steps/export-user-data/profiles.js";
import { buildMockLogger } from "../../build-mock-logger.js";

type MessagesByUserId = Parameters<typeof getAttachmentFileIdsByUserId>[0];
type MessageItem = MessagesByUserId[string][number];

// The extractor only cares about `attachmentIds`; build minimal stand-ins.
const message = (attachmentIds: string[] | null | undefined): MessageItem =>
  ({ attachmentIds }) as unknown as MessageItem;

const { logger } = buildMockLogger({});

describe("getAttachmentFileIdsByUserId", () => {
  it("dedupes repeated attachment ids across a user's messages", () => {
    const result = getAttachmentFileIdsByUserId({
      userA: [message(["F1", "F2"]), message(["F2", "F3"]), message(["F1"])],
    } as unknown as MessagesByUserId);

    expect(result.userA).toEqual(["F1", "F2", "F3"]);
  });

  it("keeps per-user isolation (user A's ids never appear under user B)", () => {
    const result = getAttachmentFileIdsByUserId({
      userA: [message(["A1", "A2"])],
      userB: [message(["B1"])],
    } as unknown as MessagesByUserId);

    expect(result.userA).toEqual(["A1", "A2"]);
    expect(result.userB).toEqual(["B1"]);
    expect(result.userB).not.toContain("A1");
    expect(result.userB).not.toContain("A2");
  });

  it("includes ids from every message a user has (multi-message, multi-attachment)", () => {
    const result = getAttachmentFileIdsByUserId({
      userA: [message(["F1", "F2"]), message(["F3"]), message(["F4", "F5"])],
    } as unknown as MessagesByUserId);

    expect(result.userA).toEqual(["F1", "F2", "F3", "F4", "F5"]);
  });

  it("omits users that have messages but zero attachments (no empty array)", () => {
    const result = getAttachmentFileIdsByUserId({
      userA: [message([]), message([])],
    } as unknown as MessagesByUserId);

    expect(result).toEqual({});
    expect("userA" in result).toBe(false);
  });

  it("handles undefined / null / [] attachmentIds without throwing and omits the user", () => {
    const result = getAttachmentFileIdsByUserId({
      userA: [message(undefined), message(null), message([])],
    } as unknown as MessagesByUserId);

    expect(result).toEqual({});
  });

  it("returns {} for empty input", () => {
    expect(getAttachmentFileIdsByUserId({})).toEqual({});
  });
});

// Builds a minimal multipart/mixed body that `downloadAndZipFiles` can parse,
// one part per requested file id.
function buildMultipartBody(fileIds: string[], boundary: string): Buffer {
  const parts = fileIds.map((id) =>
    Buffer.from(
      `--${boundary}\r\n` +
        `content-disposition: attachment; filename="${id}.bin"\r\n` +
        `content-type: application/octet-stream\r\n` +
        `\r\n` +
        `content-${id}\r\n`,
    ),
  );
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

describe("export file selection (leak guard)", () => {
  it("downloads only message-scoped attachment ids and never the polluted shared file", async () => {
    const boundary = "testboundary123";
    const targetUserId = "user-target";

    // Messaging is the source of truth: search returns [F1, F2] for the user
    // (spread across messages, with a duplicate to exercise dedupe).
    const postMessagesSearch = vi.fn(async () => ({
      data: [
        { recipientUserId: targetUserId, attachmentIds: ["F1", "F2"] },
        { recipientUserId: targetUserId, attachmentIds: ["F1"] },
      ],
      error: null,
      metadata: { totalCount: 2 },
    }));
    const messagingSupportSdk = {
      postMessagesSearch,
    } as unknown as Messaging["support"];

    // A polluted shared-files source that must NOT drive the export.
    const getSharedFilesForUser = vi.fn(async () => ({
      data: [{ id: "F1" }, { id: "F2" }, { id: "F_LEAKED" }],
      error: null,
    }));

    const getFilesCalls: { fileIds: string[]; userId: string }[] = [];
    const getFiles = vi.fn(
      async ({ fileIds, userId }: { fileIds: string[]; userId: string }) => {
        getFilesCalls.push({ fileIds, userId });
        return {
          data: [buildMultipartBody(fileIds, boundary)],
          status: 200,
          headers: { "content-type": `multipart/mixed; boundary=${boundary}` },
          error: null,
        };
      },
    );

    const uploadSupportSdk = {
      getFiles,
      getSharedFilesForUser,
    } as unknown as Upload["support"];

    // Rewired selection: fetch messages first, derive the file set from them.
    const messagesResult = await getMessagesForUsers({
      userIds: [targetUserId],
      messagingSupportSdk,
      logger,
    });
    expect(messagesResult.success).toBe(true);
    if (!messagesResult.success) return;

    const fileIdsByUserId = getAttachmentFileIdsByUserId(messagesResult.data);
    expect(fileIdsByUserId[targetUserId]).toEqual(["F1", "F2"]);

    const zip = new ZipArchive({ zlib: { level: 0 } });
    const sink = new Writable({
      write(_chunk, _encoding, cb) {
        cb();
      },
    });
    zip.pipe(sink);

    const result = await downloadAndZipFiles({
      fileIdsByUserId,
      uploadSupportSdk,
      zip,
      logger,
    });

    await zip.finalize();

    expect(result.success).toBe(true);

    // The download step was invoked with EXACTLY the message-scoped ids.
    expect(getFiles).toHaveBeenCalledTimes(1);
    expect(getFilesCalls).toHaveLength(1);
    expect(getFilesCalls[0].userId).toBe(targetUserId);
    expect(getFilesCalls[0].fileIds).toEqual(["F1", "F2"]);

    // The polluted id is never requested from any getFiles call.
    const allRequestedIds = getFilesCalls.flatMap((c) => c.fileIds);
    expect(allRequestedIds).not.toContain("F_LEAKED");

    // The polluted shared-files source no longer drives file selection.
    expect(getSharedFilesForUser).not.toHaveBeenCalled();
  });
});

describe("linked (parent-child) profile export", () => {
  // Regression guard for AB#41238: a parent's export must still include a file
  // that is attached only to a CHILD's message. The export expands linked
  // profiles (getProfileIdsToExport -> [parent, ...children]) BEFORE deriving
  // the file set from message attachments, so the child's attachment survives
  // even though the parent has no files_users row of its own for it. An
  // unrelated (unlinked) user's file must never be pulled in.
  it("includes a child's message attachment in the parent's export and excludes an unlinked user's file", async () => {
    const boundary = "linkedboundary123";
    const parentId = "user-parent";
    const childId = "user-child";
    const unlinkedId = "user-unlinked";

    const childFileId = "F_CHILD";
    const parentFileId = "F_PARENT";
    const unlinkedFileId = "F_UNLINKED";

    // Expansion is downward-only: parent -> its children (get-linked-profiles
    // selects WHERE primary_user_id = $1 AND id != $1).
    const profileIdsToExport = getProfileIdsToExport({
      profileId: parentId,
      linkedProfiles: [{ id: childId }],
    });
    expect(profileIdsToExport).toEqual([parentId, childId]);
    expect(profileIdsToExport).not.toContain(unlinkedId);

    // Messaging is the source of truth. It is only ever queried for the
    // parent + linked children, so the unlinked user's file cannot enter the
    // set. The child's file is attached ONLY to the child's message.
    const searchCalls: { recipientUserIds: string[] }[] = [];
    const postMessagesSearch = vi.fn(
      async (
        _pagination: { limit: string; offset: string },
        body: { recipientUserIds: string[] },
      ) => {
        searchCalls.push({ recipientUserIds: body.recipientUserIds });
        const data = [
          { recipientUserId: parentId, attachmentIds: [parentFileId] },
          { recipientUserId: childId, attachmentIds: [childFileId] },
        ].filter((m) => body.recipientUserIds.includes(m.recipientUserId));
        return { data, error: null, metadata: { totalCount: data.length } };
      },
    );
    const messagingSupportSdk = {
      postMessagesSearch,
    } as unknown as Messaging["support"];

    const getFilesCalls: { fileIds: string[]; userId: string }[] = [];
    const getFiles = vi.fn(
      async ({ fileIds, userId }: { fileIds: string[]; userId: string }) => {
        getFilesCalls.push({ fileIds, userId });
        return {
          data: [buildMultipartBody(fileIds, boundary)],
          status: 200,
          headers: { "content-type": `multipart/mixed; boundary=${boundary}` },
          error: null,
        };
      },
    );
    const uploadSupportSdk = { getFiles } as unknown as Upload["support"];

    const messagesResult = await getMessagesForUsers({
      userIds: profileIdsToExport,
      messagingSupportSdk,
      logger,
    });
    expect(messagesResult.success).toBe(true);
    if (!messagesResult.success) return;

    // The messaging search was scoped to the parent + child set only.
    expect(searchCalls).toHaveLength(1);
    expect(searchCalls[0].recipientUserIds).toEqual([parentId, childId]);

    const fileIdsByUserId = getAttachmentFileIdsByUserId(messagesResult.data);
    expect(fileIdsByUserId[childId]).toEqual([childFileId]);
    expect(fileIdsByUserId[parentId]).toEqual([parentFileId]);
    expect(unlinkedId in fileIdsByUserId).toBe(false);

    const zip = new ZipArchive({ zlib: { level: 0 } });
    const sink = new Writable({
      write(_chunk, _encoding, cb) {
        cb();
      },
    });
    zip.pipe(sink);

    const result = await downloadAndZipFiles({
      fileIdsByUserId,
      uploadSupportSdk,
      zip,
      logger,
    });
    await zip.finalize();

    expect(result.success).toBe(true);

    // The child's file is downloaded under the child's own id (so the upload
    // per-id ACL check is satisfied), and the parent's own file too.
    const childCall = getFilesCalls.find((c) => c.userId === childId);
    expect(childCall?.fileIds).toEqual([childFileId]);
    const parentCall = getFilesCalls.find((c) => c.userId === parentId);
    expect(parentCall?.fileIds).toEqual([parentFileId]);

    // The unlinked user's file is never requested from any user context.
    const allRequestedIds = getFilesCalls.flatMap((c) => c.fileIds);
    expect(allRequestedIds).toContain(childFileId);
    expect(allRequestedIds).not.toContain(unlinkedFileId);
    expect(getFilesCalls.some((c) => c.userId === unlinkedId)).toBe(false);
  });
});
