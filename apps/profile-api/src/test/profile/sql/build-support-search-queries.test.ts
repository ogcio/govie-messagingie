import { describe, expect, it } from "vitest";
import { buildSupportSearchQueries } from "~/services/profiles/sql/build-support-search-queries.js";

const pagination = { offset: "0", limit: "10" };

describe("buildSupportSearchQueries", () => {
  it("builds queries without any search criteria", () => {
    const { count, data } = buildSupportSearchQueries({
      body: {},
      pagination,
    });

    expect(count.query).not.toContain("AND (");
    expect(count.values).toEqual([]);
    expect(data.values).toEqual([0, 10]); // [offset, offset + limit]
  });

  it("skips empty and whitespace-only values", () => {
    const { count } = buildSupportSearchQueries({
      body: { name: ["  "], email: [""], ppsn: [" "], id: ["  "] },
      pagination,
    });

    expect(count.values).toEqual([]);
    expect(count.query).not.toContain("AND (");
  });

  it("builds name clauses matching public name and first/last combinations", () => {
    const { count } = buildSupportSearchQueries({
      body: { name: [" Jane Doe "] },
      pagination,
    });

    expect(count.query).toContain("p.public_name ILIKE $1");
    expect(count.values).toEqual(["%Jane Doe%"]);
  });

  it("builds email and ppsn clauses", () => {
    const { count } = buildSupportSearchQueries({
      body: { email: ["jane@example.com"], ppsn: ["1234567A"] },
      pagination,
    });

    expect(count.query).toContain("pde.name = 'email'");
    expect(count.query).toContain("pde.name = 'ppsn'");
    expect(count.values).toEqual(["%jane@example.com%", "%1234567A%"]);
  });

  it("builds date-of-birth range clauses for from, to and both", () => {
    const { count } = buildSupportSearchQueries({
      body: {
        dateOfBirth: [
          { from: "1990-01-01" },
          { to: "2000-12-31" },
          { from: "1980-01-01", to: "1989-12-31" },
          {},
        ],
      },
      pagination,
    });

    expect(count.query).toContain("pde.value >= $1");
    expect(count.query).toContain("pde.value <= $2");
    expect(count.values).toEqual([
      "1990-01-01",
      "2000-12-31",
      "1980-01-01",
      "1989-12-31",
    ]);
  });

  it("builds id clauses matching profile id or primary user id", () => {
    const { count } = buildSupportSearchQueries({
      body: { id: ["abc-123"] },
      pagination,
    });

    expect(count.query).toContain("(p.id = $1 OR p.primary_user_id = $1)");
    expect(count.values).toEqual(["abc-123"]);
  });

  it("joins clauses with OR when requested", () => {
    const { count } = buildSupportSearchQueries({
      body: {
        logicalOperator: "or",
        name: ["Jane"],
        email: ["jane@example.com"],
      },
      pagination,
    });

    expect(count.query).toContain(" OR ");
    expect(count.query).toContain("AND (");
  });

  it("defaults to AND and appends pagination values to the data query", () => {
    const { data } = buildSupportSearchQueries({
      body: { name: ["Jane"], email: ["j@e.com"] },
      pagination: { offset: "20", limit: "5" },
    });

    expect(data.query).toContain(" AND ");
    // Data query paginates on a row-number window: [offset, offset + limit].
    expect(data.values).toEqual(["%Jane%", "%j@e.com%", 20, 25]);
  });
});
