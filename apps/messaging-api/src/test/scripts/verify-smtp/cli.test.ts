import { InvalidArgumentError } from "commander";
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../../../scripts/verify-smtp/cli.js";

const explicitArgs = [
  "--host",
  "smtp.example.com",
  "--port",
  "587",
  "--username",
  "user",
  "--password",
  "pass",
  "--secure",
  "false",
];

describe("verify-smtp parseCliArgs", () => {
  it("parses explicit flags into an explicit command", () => {
    const command = parseCliArgs([...explicitArgs, "--from-address", "a@b.ie"]);

    expect(command).toEqual({
      kind: "explicit",
      host: "smtp.example.com",
      port: 587,
      username: "user",
      password: "pass",
      secure: false,
      fromAddress: "a@b.ie",
    });
  });

  it("parses --secure true and leaves fromAddress undefined", () => {
    const command = parseCliArgs([
      "--host",
      "h",
      "--port",
      "1",
      "--username",
      "u",
      "--password",
      "p",
      "--secure",
      "true",
    ]);

    expect(command).toMatchObject({ secure: true, fromAddress: undefined });
  });

  it("returns env-config command for --use-env-config", () => {
    expect(parseCliArgs(["--use-env-config"])).toEqual({ kind: "env-config" });
  });

  it("rejects --use-env-config combined with explicit flags", () => {
    expect(() =>
      parseCliArgs(["--use-env-config", "--host", "smtp.example.com"]),
    ).toThrow(/cannot be combined with explicit SMTP flags: --host/);
  });

  it("lists every missing required option", () => {
    try {
      parseCliArgs([]);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidArgumentError);
      const message = (error as Error).message;
      expect(message).toContain("--host is required");
      expect(message).toContain("--port is required");
      expect(message).toContain("--username is required");
      expect(message).toContain("--password is required");
      expect(message).toContain("--secure is required");
    }
  });

  it("rejects a non-integer port", () => {
    expect(() =>
      parseCliArgs([...explicitArgs.slice(0, 2), "--port", "abc"]),
    ).toThrow(/Expected an integer for --port/);
  });

  it("rejects an out-of-range port", () => {
    expect(() =>
      parseCliArgs([...explicitArgs.slice(0, 2), "--port", "70000"]),
    ).toThrow(/--port must be between 1 and 65535/);
  });

  it("rejects a non-boolean --secure value", () => {
    expect(() =>
      parseCliArgs([
        "--host",
        "h",
        "--port",
        "25",
        "--username",
        "u",
        "--password",
        "p",
        "--secure",
        "maybe",
      ]),
    ).toThrow(/Expected true or false for --secure/);
  });
});
