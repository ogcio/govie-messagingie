import type { FastifyInstance } from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const trackEvent = vi.fn();
vi.mock("~/utils/authentication-factory.js", () => ({
  getOrgAnalyticsSdk: vi.fn(async () => ({ track: { event: trackEvent } })),
  ensureUserIdIsSet: vi.fn(() => "user-1"),
}));

const privateDetailsRequested = vi.fn();
vi.mock("~/routes/profiles/shared.js", () => ({
  privateDetailsRequested: (...args: unknown[]) =>
    privateDetailsRequested(...args),
}));

const hasPermissions = vi.fn();
vi.mock("~/utils/has-permissions.js", () => ({
  hasPermissions: (...args: unknown[]) => hasPermissions(...args),
}));

const saveRequestFile = vi.fn();
vi.mock("~/utils/save-request-file.js", () => ({
  saveRequestFile: (...args: unknown[]) => saveRequestFile(...args),
}));

const getProfilesFromCsv = vi.fn();
vi.mock("~/services/profiles/get-profiles-from-csv.js", () => ({
  getProfilesFromCsv: (...args: unknown[]) => getProfilesFromCsv(...args),
}));

const normalizeProfiles = vi.fn((profiles: unknown[]) => profiles);
vi.mock("~/services/profiles/normalize-profile.js", () => ({
  normalizeProfiles: (...args: unknown[]) =>
    normalizeProfiles(...(args as [unknown[]])),
}));

import { processImportProfileRequestBody } from "~/services/profiles/imports/process-import-profile-request-body.js";

const fastify = { config: {} } as unknown as FastifyInstance;
const reply = {} as never;

const jsonProfiles = [{ email: "a@example.com", firstName: "A" }];

const buildRequest = (opts: {
  contentType?: string;
  query?: Record<string, unknown>;
  body?: Record<string, unknown>;
}) =>
  ({
    headers: { "content-type": opts.contentType },
    query: opts.query ?? {},
    body: opts.body ?? {},
    log: { debug: vi.fn() },
    userData: { organizationId: "org-1" },
  }) as never;

describe("processImportProfileRequestBody", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    privateDetailsRequested.mockResolvedValue(false);
    hasPermissions.mockResolvedValue(false);
  });

  it("reads profiles from the json body for immediate execution", async () => {
    const result = await processImportProfileRequestBody({
      fastify,
      reply,
      request: buildRequest({
        contentType: "application/json",
        body: { profiles: jsonProfiles },
      }),
    });

    expect(result.profiles).toEqual(jsonProfiles);
    expect(result.immediateExecution).toBe(true);
    expect(result.sourceType).toBe("json");
    expect(result.fileMetadata).toBeUndefined();
    expect(trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        contextOverride: expect.objectContaining({
          customDimensions: expect.objectContaining({ source: "JSON" }),
        }),
      }),
    );
  });

  it("reads ppsn-only profiles when the import type says so", async () => {
    const ppsnOnly = [{ ppsn: "1234567A" }];

    const result = await processImportProfileRequestBody({
      fastify,
      reply,
      request: buildRequest({
        contentType: "application/json",
        query: { importType: "ppsn-only" },
        body: { ppsnOnlyProfiles: ppsnOnly },
      }),
    });

    expect(result.profiles).toEqual(ppsnOnly);
  });

  it("parses an uploaded csv file when the request is not json", async () => {
    saveRequestFile.mockResolvedValue({
      filepath: "/tmp/import.csv",
      metadata: { filename: "import.csv" },
    });
    getProfilesFromCsv.mockResolvedValue(jsonProfiles);

    const result = await processImportProfileRequestBody({
      fastify,
      reply,
      request: buildRequest({ contentType: "multipart/form-data" }),
    });

    expect(getProfilesFromCsv).toHaveBeenCalledWith(
      "/tmp/import.csv",
      undefined,
    );
    expect(result.profiles).toEqual(jsonProfiles);
    expect(result.immediateExecution).toBe(false);
    expect(result.sourceType).toBe("csv");
    expect(result.fileMetadata).toEqual({ filename: "import.csv" });
  });

  it("treats a missing content type as csv", async () => {
    saveRequestFile.mockResolvedValue({
      filepath: "/tmp/i.csv",
      metadata: {},
    });
    getProfilesFromCsv.mockResolvedValue([]);

    const result = await processImportProfileRequestBody({
      fastify,
      reply,
      request: buildRequest({}),
    });

    expect(result.sourceType).toBe("csv");
  });

  it("derives onlyPrivateDetails from private details and the query flag", async () => {
    privateDetailsRequested.mockResolvedValue(true);

    const withFlag = await processImportProfileRequestBody({
      fastify,
      reply,
      request: buildRequest({
        contentType: "application/json",
        query: { onlyPrivateDetails: "true" },
        body: { profiles: jsonProfiles },
      }),
    });
    expect(withFlag.insertPrivateDetails).toBe(true);
    expect(withFlag.onlyPrivateDetails).toBe(true);

    const withoutFlag = await processImportProfileRequestBody({
      fastify,
      reply,
      request: buildRequest({
        contentType: "application/json",
        body: { profiles: jsonProfiles },
      }),
    });
    expect(withoutFlag.onlyPrivateDetails).toBe(false);
  });
});
