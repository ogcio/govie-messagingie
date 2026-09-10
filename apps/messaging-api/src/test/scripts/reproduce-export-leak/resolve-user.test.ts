import { describe, expect, it, vi } from "vitest";
import { resolveUser } from "../../../scripts/reproduce-export-leak/resolve/resolve-user.js";

type ProfileStub = Parameters<typeof resolveUser>[0]["profile"];

function makeProfile(response: { data?: unknown; error?: unknown }) {
  return {
    findProfile: vi.fn().mockResolvedValue(response),
  } as unknown as ProfileStub;
}

describe("resolveUser", () => {
  it("uses a non-email identifier directly as profile id", async () => {
    const profile = makeProfile({});
    const resolved = await resolveUser({ profile, identifier: "abc123" });

    expect(resolved).toEqual({
      identifier: "abc123",
      profileId: "abc123",
      resolvedVia: "profileId",
    });
    expect(
      (profile as unknown as { findProfile: ReturnType<typeof vi.fn> })
        .findProfile,
    ).not.toHaveBeenCalled();
  });

  it("resolves an email via findProfile with an enveloped list", async () => {
    const profile = makeProfile({
      data: { data: [{ id: "profile-1" }, { id: "profile-2" }] },
    });

    const resolved = await resolveUser({
      profile,
      identifier: "user@example.com",
    });

    expect(resolved).toEqual({
      identifier: "user@example.com",
      profileId: "profile-1",
      resolvedVia: "email",
    });
  });

  it("resolves a bare single-object response", async () => {
    const profile = makeProfile({ data: { id: "profile-9" } });

    const resolved = await resolveUser({
      profile,
      identifier: "solo@example.com",
    });

    expect(resolved.profileId).toBe("profile-9");
  });

  it("throws with SDK error detail when findProfile fails", async () => {
    const profile = makeProfile({ error: { detail: "boom" } });

    await expect(
      resolveUser({ profile, identifier: "user@example.com" }),
    ).rejects.toThrow(/findProfile failed for "user@example.com": boom/);
  });

  it("throws when no profile matches the email", async () => {
    const profile = makeProfile({ data: { data: [] } });

    await expect(
      resolveUser({ profile, identifier: "ghost@example.com" }),
    ).rejects.toThrow(/No profile found for email "ghost@example.com"/);
  });
});
