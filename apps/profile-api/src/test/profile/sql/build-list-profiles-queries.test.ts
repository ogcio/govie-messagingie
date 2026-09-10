import { describe, expect, it } from "vitest";
import { buildListProfilesQueries } from "~/services/profiles/sql/build-list-profiles-queries.js";

const pagination = { limit: "10", offset: "0" };

describe("buildListProfilesQueries", () => {
  it("builds queries without organisation or search params", () => {
    const { count, data } = buildListProfilesQueries({
      organisationId: undefined,
      pagination,
      consentSubjects: [],
    });

    expect(count.query).not.toContain("pd.organisation_id = $1");
    expect(count.values).toEqual([]);
    expect(data.values).toEqual([[], "10", "0"]);
    expect(data.query).not.toContain("INNER JOIN profile_data pdata");
  });

  it("scopes to the organisation when provided", () => {
    const { count, data } = buildListProfilesQueries({
      organisationId: "org-1",
      pagination,
      consentSubjects: ["messaging"],
    });

    expect(count.query).toContain("pd.organisation_id = $1");
    expect(count.values).toEqual(["org-1"]);
    expect(data.values).toEqual(["org-1", ["messaging"], "10", "0"]);
  });

  it("adds an activeOnly clause", () => {
    const { count } = buildListProfilesQueries({
      organisationId: undefined,
      pagination,
      activeOnly: true,
      consentSubjects: [],
    });
    expect(count.query).toContain("p.deleted_at IS NULL");
  });

  it("builds a free-text search clause joining profile data", () => {
    const { count, data } = buildListProfilesQueries({
      organisationId: "org-1",
      pagination,
      searchParams: { search: " smith " },
      consentSubjects: [],
    });

    expect(count.query).toContain("p.email ILIKE $2");
    expect(count.values).toEqual(["org-1", "%smith%"]);
    expect(data.query).toContain("INNER JOIN profile_data pdata");
  });

  it("combines first name, last name and email into one EXISTS clause", () => {
    const { count } = buildListProfilesQueries({
      organisationId: undefined,
      pagination,
      searchParams: {
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
      },
      consentSubjects: [],
    });

    expect(count.query).toContain("EXISTS (");
    expect(count.values).toEqual(["%Jane%", "%Doe%", "%jane@example.com%"]);
  });

  it("filters by ppsns and ignores blank entries", () => {
    const { count } = buildListProfilesQueries({
      organisationId: undefined,
      pagination,
      searchParams: { ppsns: ["1234567A", " "] },
      consentSubjects: [],
    });

    expect(count.query).toContain("pde.value = ANY($1)");
    expect(count.values).toEqual([["1234567A"]]);
  });

  it("skips search clauses for whitespace-only params", () => {
    const { count } = buildListProfilesQueries({
      organisationId: undefined,
      pagination,
      searchParams: { search: "  ", firstName: " ", ppsns: [] },
      consentSubjects: [],
    });

    expect(count.values).toEqual([]);
    expect(count.query).not.toContain("ILIKE");
  });
});
