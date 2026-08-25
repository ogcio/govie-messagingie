import { Command, CommanderError, InvalidArgumentError } from "commander";
import type {
  CleanupCommand,
  CliCommand,
  SeedCommand,
} from "./domain/types.js";

/**
 * Parses argv (already sliced past `node script`) into a discriminated command.
 * Uses commander with `exitOverride` so `--help`/parse errors bubble up as
 * `CommanderError` and can be handled by the entrypoint without a hard exit.
 */
export function parseCliArgs(args: readonly string[]): CliCommand {
  // pnpm's script-shortcut form (`pnpm reproduce-export-leak -- seed`) forwards
  // the `--` separator verbatim, unlike `pnpm run … -- seed` which strips it.
  // Drop a single leading `--` so both documented invocation forms resolve the
  // subcommand instead of falling through to the help/usage branch.
  const normalized = args[0] === "--" ? args.slice(1) : args;
  const [subcommand, ...rest] = normalized;

  switch (subcommand) {
    case "seed":
      return parseSeedCommand(rest);
    case "cleanup":
      return parseCleanupCommand(rest);
    default:
      return parseRootHelp(normalized);
  }
}

function parseRootHelp(args: readonly string[]): never {
  const command = new Command("reproduce-export-leak");
  command
    .exitOverride()
    .description(
      "Operator task to reproduce a cross-user data-export leak in dev/uat.",
    )
    .command("seed")
    .description("Seed two users, then inject a cross-user file share (leak).");
  command
    .command("cleanup")
    .description(
      "Remove the injected leak share (and optionally seeded data).",
    );

  command.outputHelp();

  // Explicit help request exits cleanly; an unknown/missing subcommand is a
  // usage error (non-zero exit).
  const requestedHelp = args[0] === "--help" || args[0] === "-h";
  if (requestedHelp) {
    throw new CommanderError(0, "commander.helpDisplayed", "(outputHelp)");
  }

  throw new InvalidArgumentError(
    `Unknown or missing subcommand: "${args[0] ?? ""}". Use seed | cleanup.`,
  );
}

function parseSeedCommand(args: readonly string[]): SeedCommand {
  const command = new Command("seed");
  command
    .exitOverride()
    .allowExcessArguments(false)
    .option("--symmetric", "Also share user1's file with user2 (bidirectional)")
    .option("--yes", "Confirm mutation against the resolved dev/uat target");
  command.parse([...args], { from: "user" });

  const options = command.opts<{ symmetric?: boolean; yes?: boolean }>();
  return {
    kind: "seed",
    symmetric: options.symmetric ?? false,
    confirm: options.yes ?? false,
  };
}

function parseCleanupCommand(args: readonly string[]): CleanupCommand {
  const command = new Command("cleanup");
  command
    .exitOverride()
    .allowExcessArguments(false)
    .option("--file-id <fileId>", "The leaked file id to un-share")
    .option("--user-id <userId>", "The user the file was leaked to")
    .option("--purge", "Also schedule deletion of the seeded files")
    .option("--yes", "Confirm mutation against the resolved dev/uat target");
  command.parse([...args], { from: "user" });

  const options = command.opts<{
    fileId?: string;
    userId?: string;
    purge?: boolean;
    yes?: boolean;
  }>();

  return {
    kind: "cleanup",
    fileId: options.fileId,
    userId: options.userId,
    purge: options.purge ?? false,
    confirm: options.yes ?? false,
  };
}
