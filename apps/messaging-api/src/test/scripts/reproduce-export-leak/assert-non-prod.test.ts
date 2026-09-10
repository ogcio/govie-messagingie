import { describe, expect, it } from "vitest";
import {
  assertEnvironmentNotProduction,
  assertMutationConfirmed,
  assertNodeEnvNotProduction,
  isProductionLikeValue,
} from "../../../scripts/reproduce-export-leak/safety/assert-non-prod.js";

describe("isProductionLikeValue", () => {
  it("flags prod and prd substrings case-insensitively", () => {
    expect(isProductionLikeValue("https://api.PROD.example")).toBe(true);
    expect(isProductionLikeValue("messaging-prd.internal")).toBe(true);
    expect(isProductionLikeValue("https://api.dev.example")).toBe(false);
  });
});

describe("assertNodeEnvNotProduction", () => {
  it("throws when NODE_ENV is production (any casing)", () => {
    expect(() =>
      assertNodeEnvNotProduction({ NODE_ENV: "Production" }),
    ).toThrow(/Refusing to run/);
  });

  it("allows development and unset NODE_ENV", () => {
    expect(() =>
      assertNodeEnvNotProduction({ NODE_ENV: "development" }),
    ).not.toThrow();
    expect(() => assertNodeEnvNotProduction({})).not.toThrow();
  });
});

describe("assertEnvironmentNotProduction", () => {
  it("throws when the environment label is production-like", () => {
    expect(() =>
      assertEnvironmentNotProduction({ environmentLabel: "prod", hosts: [] }),
    ).toThrow(/environment "prod" looks production-like/);
  });

  it("throws when any resolved host is production-like", () => {
    expect(() =>
      assertEnvironmentNotProduction({
        environmentLabel: "custom",
        hosts: ["https://upload.dev.example", "https://api.prd.example"],
      }),
    ).toThrow(/host "https:\/\/api\.prd\.example" looks production-like/);
  });

  it("passes for dev/uat labels and hosts", () => {
    expect(() =>
      assertEnvironmentNotProduction({
        environmentLabel: "uat",
        hosts: ["https://upload.uat.example"],
      }),
    ).not.toThrow();
  });
});

describe("assertMutationConfirmed", () => {
  it("accepts --yes", () => {
    expect(() =>
      assertMutationConfirmed({ confirm: true, env: {}, action: "seed" }),
    ).not.toThrow();
  });

  it("accepts REPRO_CONFIRM=yes with whitespace and casing", () => {
    expect(() =>
      assertMutationConfirmed({
        confirm: false,
        env: { REPRO_CONFIRM: " YES " },
        action: "seed",
      }),
    ).not.toThrow();
  });

  it("refuses without explicit confirmation", () => {
    expect(() =>
      assertMutationConfirmed({ confirm: false, env: {}, action: "cleanup" }),
    ).toThrow(/Refusing to cleanup without explicit confirmation/);
  });
});
