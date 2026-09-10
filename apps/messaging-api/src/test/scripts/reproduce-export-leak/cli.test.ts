import { CommanderError, InvalidArgumentError } from "commander";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseCliArgs } from "../../../scripts/reproduce-export-leak/cli.js";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("reproduce-export-leak parseCliArgs", () => {
  it("parses a bare seed command with defaults", () => {
    expect(parseCliArgs(["seed"])).toEqual({
      kind: "seed",
      symmetric: false,
      confirm: false,
    });
  });

  it("parses seed flags", () => {
    expect(parseCliArgs(["seed", "--symmetric", "--yes"])).toEqual({
      kind: "seed",
      symmetric: true,
      confirm: true,
    });
  });

  it("drops a single leading -- separator (pnpm shortcut form)", () => {
    expect(parseCliArgs(["--", "seed"])).toMatchObject({ kind: "seed" });
  });

  it("parses cleanup flags", () => {
    expect(
      parseCliArgs([
        "cleanup",
        "--file-id",
        "file-1",
        "--user-id",
        "user-1",
        "--purge",
        "--yes",
      ]),
    ).toEqual({
      kind: "cleanup",
      fileId: "file-1",
      userId: "user-1",
      purge: true,
      confirm: true,
    });
  });

  it("parses a bare cleanup command with defaults", () => {
    expect(parseCliArgs(["cleanup"])).toEqual({
      kind: "cleanup",
      fileId: undefined,
      userId: undefined,
      purge: false,
      confirm: false,
    });
  });

  it("treats --help as a clean commander exit", () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    try {
      parseCliArgs(["--help"]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(CommanderError);
      expect((error as CommanderError).exitCode).toBe(0);
    }
  });

  it("treats an unknown subcommand as a usage error", () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(() => parseCliArgs(["destroy"])).toThrow(InvalidArgumentError);
  });

  it("treats a missing subcommand as a usage error", () => {
    vi.spyOn(process.stdout, "write").mockReturnValue(true);
    expect(() => parseCliArgs([])).toThrow(/Unknown or missing subcommand/);
  });
});
