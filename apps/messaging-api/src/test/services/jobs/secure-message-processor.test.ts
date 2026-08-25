import { describe, expect, it } from "vitest";
import { appendCampaignParams } from "../../../services/jobs/secure-message-processor.js";

describe("appendCampaignParams", () => {
  it("adds Matomo campaign params to a plain url", () => {
    const result = appendCampaignParams(
      "https://messaging.services.gov.ie/en/messages/abc-123",
      "org-1",
    );
    const url = new URL(result);
    expect(url.searchParams.get("mtm_campaign")).toBe("message-notification");
    expect(url.searchParams.get("mtm_source")).toBe("email");
    expect(url.searchParams.get("mtm_keyword")).toBe("org-1");
    expect(url.pathname).toBe("/en/messages/abc-123");
  });

  it("preserves pre-existing query params", () => {
    const result = appendCampaignParams(
      "https://messaging.services.gov.ie/en/messages/abc-123?foo=bar",
      "org-1",
    );
    const url = new URL(result);
    expect(url.searchParams.get("foo")).toBe("bar");
    expect(url.searchParams.get("mtm_campaign")).toBe("message-notification");
  });

  it("returns the input unchanged when it is not a valid absolute URL", () => {
    expect(appendCampaignParams("{{broken template}}", "org-1")).toBe(
      "{{broken template}}",
    );
  });
});
