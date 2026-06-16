import { Command, InvalidArgumentError } from "commander";

export type EnvConfigCommand = {
  readonly kind: "env-config";
};

export type ExplicitConfigCommand = {
  readonly kind: "explicit";
  readonly host: string;
  readonly port: number;
  readonly username: string;
  readonly password: string;
  readonly secure: boolean;
  readonly fromAddress: string | undefined;
};

export type CliCommand = EnvConfigCommand | ExplicitConfigCommand;

const EXPLICIT_FLAGS = [
  "--host",
  "--port",
  "--username",
  "--password",
  "--secure",
  "--from-address",
];

export function parseCliArgs(args: readonly string[]): CliCommand {
  const command = new Command("verify-smtp");

  command
    .exitOverride()
    .allowExcessArguments(false)
    .option("--use-env-config", "Read SMTP config from the colocated .env file")
    .option("--host <host>", "SMTP host")
    .option("--port <port>", "SMTP port", parseIntegerOption)
    .option("--username <username>", "SMTP auth username")
    .option("--password <password>", "SMTP auth password")
    .option(
      "--secure <bool>",
      "Use TLS (true = implicit TLS on connect, false = STARTTLS or plain)",
      parseBooleanOption,
    )
    .option("--from-address <address>", "Optional from address (summary only)");

  command.parse([...args], { from: "user" });

  const opts = command.opts<{
    useEnvConfig?: boolean;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    secure?: boolean;
    fromAddress?: string;
  }>();

  if (opts.useEnvConfig === true) {
    const mixedFlags = EXPLICIT_FLAGS.filter((flag) => args.includes(flag));

    if (mixedFlags.length > 0) {
      throw new InvalidArgumentError(
        `--use-env-config cannot be combined with explicit SMTP flags: ${mixedFlags.join(", ")}`,
      );
    }

    return { kind: "env-config" };
  }

  const problems: string[] = [];

  if (!opts.host || opts.host.trim().length === 0) {
    problems.push("--host is required");
  }
  if (opts.port == null) {
    problems.push("--port is required");
  }
  if (!opts.username || opts.username.trim().length === 0) {
    problems.push("--username is required");
  }
  if (!opts.password || opts.password.trim().length === 0) {
    problems.push("--password is required");
  }
  if (opts.secure == null) {
    problems.push("--secure is required (true or false)");
  }

  if (problems.length > 0) {
    throw new InvalidArgumentError(
      `Missing required options: ${problems.join("; ")}`,
    );
  }

  return {
    kind: "explicit",
    host: opts.host as string,
    port: opts.port as number,
    username: opts.username as string,
    password: opts.password as string,
    secure: opts.secure as boolean,
    fromAddress: opts.fromAddress,
  };
}

function parseIntegerOption(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new InvalidArgumentError(
      `Expected an integer for --port, received: ${value}`,
    );
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new InvalidArgumentError(
      `--port must be between 1 and 65535, received: ${value}`,
    );
  }

  return parsed;
}

function parseBooleanOption(value: string): boolean {
  const normalized = value.trim().toLowerCase();

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  throw new InvalidArgumentError(
    `Expected true or false for --secure, received: ${value}`,
  );
}
