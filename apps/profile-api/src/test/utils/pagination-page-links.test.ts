import { describe, expect, it } from "vitest";
import {
  PAGINATION_LIMIT_DEFAULT,
  PAGINATION_OFFSET_DEFAULT,
} from "~/const/pagination.js";
import { getPaginationLinks } from "~/utils/pagination.js";

const baseUrl = new URL("http://api.example.com/profiles");

describe("getPaginationLinks page-link generation", () => {
  it("falls back to default limit and offset when missing", () => {
    const links = getPaginationLinks({ url: baseUrl }, 5);
    expect(links.self.href).toContain(`limit=${PAGINATION_LIMIT_DEFAULT}`);
    expect(links.self.href).toContain(`offset=${PAGINATION_OFFSET_DEFAULT}`);
  });

  it("points last at offset 0 when there are no results", () => {
    const links = getPaginationLinks({ url: baseUrl, limit: 10, offset: 0 }, 0);
    expect(links.last.href).toContain("offset=0");
    expect(links.pages).toEqual({});
  });

  it("returns no page links for a single batch", () => {
    const links = getPaginationLinks({ url: baseUrl, limit: 10, offset: 0 }, 5);
    expect(links.pages).toEqual({});
    expect(links.next.href).toBeUndefined();
    expect(links.prev.href).toBeUndefined();
  });

  it("lists every page when there are at most five batches", () => {
    const links = getPaginationLinks(
      { url: baseUrl, limit: 10, offset: 0 },
      50,
    );
    expect(Object.keys(links.pages)).toEqual(["1", "2", "3", "4", "5"]);
    expect(links.pages["5"].href).toContain("offset=40");
  });

  it("summarises pages around the first batch when there are many batches", () => {
    const links = getPaginationLinks(
      { url: baseUrl, limit: 10, offset: 0 },
      100,
    );
    // first, second, third and last page
    expect(Object.keys(links.pages).sort()).toEqual(
      ["1", "2", "3", "10"].sort(),
    );
    expect(links.pages["10"].href).toContain("offset=90");
  });

  it("summarises pages around the last batch", () => {
    const links = getPaginationLinks(
      { url: baseUrl, limit: 10, offset: 90 },
      100,
    );
    expect(Object.keys(links.pages).sort()).toEqual(
      ["1", "8", "9", "10"].sort(),
    );
    expect(links.next.href).toBeUndefined();
    expect(links.prev.href).toContain("offset=80");
  });

  it("summarises pages around a middle batch", () => {
    const links = getPaginationLinks(
      { url: baseUrl, limit: 10, offset: 50 },
      100,
    );
    // first, previous, current, next and last page
    expect(Object.keys(links.pages).sort()).toEqual(
      ["1", "5", "6", "7", "10"].sort(),
    );
    expect(links.pages["6"].href).toContain("offset=50");
  });
});
