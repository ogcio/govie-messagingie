import type { ZipArchive } from "archiver";
import { describe, expect, it, vi } from "vitest";
import { appendStructuredDataToZip } from "~/scripts/lifecycle-worker/steps/export-user-data/zip.js";

describe("appendStructuredDataToZip", () => {
  it("appends profile data and messages per profile", () => {
    const append = vi.fn();
    const zip = { append } as unknown as ZipArchive;

    appendStructuredDataToZip({
      zip,
      profileIds: ["p1", "p2"],
      profileDataById: new Map([["p1", { id: "p1", name: "One" }]]),
      messagesByUserId: { p1: [{ id: "m1" }] },
    });

    // p1: profile.ndjson with data + messages.ndjson
    expect(append).toHaveBeenCalledWith('{"id":"p1","name":"One"}\n', {
      name: "p1/profile.ndjson",
    });
    expect(append).toHaveBeenCalledWith('{"id":"m1"}\n', {
      name: "p1/messages.ndjson",
    });
    // p2: empty profile.ndjson, no messages file
    expect(append).toHaveBeenCalledWith("", { name: "p2/profile.ndjson" });
    expect(append).toHaveBeenCalledTimes(3);
  });
});
