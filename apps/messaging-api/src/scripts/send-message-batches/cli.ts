import { Command, InvalidArgumentError } from "commander";
import type { CliCommand, RunCommand, StatusCommand } from "./domain/types.js";

export function parseCliArgs(args: readonly string[]): CliCommand {
  if (args[0] === "status") {
    return parseStatusCommand(args.slice(1));
  }

  if (args[0] === "run") {
    return parseRunCommand(args.slice(1));
  }

  return parseRunCommand(args);
}

function parseRunCommand(args: readonly string[]): RunCommand {
  const command = new Command("send-message-batches");

  command
    .exitOverride()
    .allowExcessArguments(false)
    .option("--force-new")
    .option("--send-at <iso-8601>")
    .option(
      "--event-sync-delay-seconds <seconds>",
      "Override the event sync delay for the current invocation",
      parseIntegerOption,
    );

  command.parse([...args], { from: "user" });

  const options = command.opts<{
    forceNew?: boolean;
    sendAt?: string;
    eventSyncDelaySeconds?: number;
  }>();

  return {
    kind: "run",
    forceNew: options.forceNew ?? false,
    sendAt: options.sendAt,
    eventSyncDelaySeconds: options.eventSyncDelaySeconds,
  };
}

function parseStatusCommand(args: readonly string[]): StatusCommand {
  const command = new Command("status");

  command
    .exitOverride()
    .allowExcessArguments(false)
    .option("--run-id <run-id>", "Target a specific run id", parseUuidOption)
    .option("--send-at <iso-8601>");

  command.parse([...args], { from: "user" });

  const options = command.opts<{
    runId?: string;
    sendAt?: string;
  }>();

  return {
    kind: "status",
    runId: options.runId,
    sendAt: options.sendAt,
  };
}

function parseIntegerOption(value: string): number {
  if (!/^\d+$/u.test(value)) {
    throw new InvalidArgumentError(`Expected an integer, received: ${value}`);
  }

  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isInteger(parsedValue)) {
    throw new InvalidArgumentError(`Expected an integer, received: ${value}`);
  }

  return parsedValue;
}

function parseUuidOption(value: string): string {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
      value,
    )
  ) {
    throw new InvalidArgumentError(`Expected a UUID, received: ${value}`);
  }

  return value;
}
