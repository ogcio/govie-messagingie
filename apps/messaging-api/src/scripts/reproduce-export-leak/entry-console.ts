import { CommanderError } from "commander";
import { parseCliArgs } from "./cli.js";
import { createSdkClients } from "./clients/create-sdk-clients.js";
import { loadConfig } from "./config/load-config.js";
import { createConsoleLogger } from "./logging/create-console-logger.js";
import { assertMutationConfirmed } from "./safety/assert-non-prod.js";
import { runCleanup } from "./subcommands/cleanup.js";
import { runSeed } from "./subcommands/seed.js";

async function main(): Promise<void> {
  const logger = createConsoleLogger();
  const command = parseCliArgs(process.argv.slice(2));
  const config = loadConfig({ env: process.env, command });

  logger.info("[reproduce-export-leak] Target resolved.", {
    subcommand: command.kind,
    environment: config.endpoints.environmentLabel,
    profileBaseUrl: config.endpoints.profileBaseUrl,
    uploadBaseUrl: config.endpoints.uploadBaseUrl,
    messagingBaseUrl: config.endpoints.messagingBaseUrl,
  });

  const clients = createSdkClients(config);

  switch (command.kind) {
    case "seed": {
      assertMutationConfirmed({
        confirm: command.confirm,
        env: process.env,
        action: "seed data and inject a cross-user share",
      });
      await runSeed({ config, command, clients, logger });
      return;
    }
    case "cleanup": {
      assertMutationConfirmed({
        confirm: command.confirm,
        env: process.env,
        action: "remove a file share",
      });
      await runCleanup({ config, command, clients, logger });
      return;
    }
    default: {
      const exhaustive: never = command;
      throw new Error(`Unhandled subcommand: ${String(exhaustive)}`);
    }
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    console.error(
      `[reproduce-export-leak] FAILED: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    process.exitCode = 1;
  }
}
