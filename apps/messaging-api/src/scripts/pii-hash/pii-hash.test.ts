import { describe, expect, it } from "vitest";
import { loadConfig } from "./index.js";

describe("loadConfig", () => {
  it("throws when 'applications' is missing", () => {
    expect(() => loadConfig(JSON.stringify({}))).toThrow(/applications/);
  });

  it("throws when 'applications' is empty", () => {
    expect(() => loadConfig(JSON.stringify({ applications: {} }))).toThrow(
      /empty/,
    );
  });

  it("throws when an app has neither secret-name nor secret-value", () => {
    const raw = JSON.stringify({ applications: { "messaging-api": {} } });
    expect(() => loadConfig(raw)).toThrow(/messaging-api/);
  });

  it("accepts an app with only a secret-value", () => {
    const raw = JSON.stringify({
      applications: { "messaging-api": { "secret-value": "abc" } },
    });
    expect(loadConfig(raw).applications["messaging-api"]["secret-value"]).toBe(
      "abc",
    );
  });

  it("accepts an app with both secret-name and secret-value", () => {
    const raw = JSON.stringify({
      applications: {
        "profile-api": { "secret-name": "n", "secret-value": "v" },
      },
    });
    expect(() => loadConfig(raw)).not.toThrow();
  });
});

import { createHmac } from "node:crypto";
import { buildPepperService, hashUserId } from "./index.js";

describe("hashUserId (offline)", () => {
  it("matches an independently computed HMAC-SHA256", async () => {
    const applicationId = "messaging-api";
    const userId = "11111111-2222-3333-4444-555555555555";
    const pepperB64 = Buffer.from("super-secret-pepper").toString("base64");

    const pepperService = buildPepperService(
      { "secret-value": pepperB64 },
      { region: "eu-west-1" },
    );
    const { hash, pepperVersion } = await hashUserId(
      userId,
      applicationId,
      pepperService,
    );

    const expected = createHmac("sha256", Buffer.from(pepperB64, "base64"))
      .update(applicationId, "utf8")
      .update("\0")
      .update(userId, "utf8")
      .digest("hex");

    expect(hash).toBe(expected);
    expect(pepperVersion).toBe("offline");
  });

  it("uses secret-value when both secret-name and secret-value are present", async () => {
    const pepperB64 = Buffer.from("pepper").toString("base64");
    const service = buildPepperService(
      { "secret-name": "ignored", "secret-value": pepperB64 },
      { region: "eu-west-1" },
    );
    const { pepperVersion } = await hashUserId("user", "app", service);
    // "offline" version proves the offline (secret-value) branch was taken,
    // i.e. no AWS call was made even though secret-name was set.
    expect(pepperVersion).toBe("offline");
  });
});
