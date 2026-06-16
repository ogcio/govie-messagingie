import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { CommanderError, InvalidArgumentError } from "commander";
import { parseCliArgs } from "./cli.js";
import type { ConfigSummary } from "./config/load-config.js";
import { loadConfig } from "./config/load-config.js";
import type { SmtpCheckResult } from "./smtp-check.js";
import { checkSmtp } from "./smtp-check.js";

function printSummaryHeader(summary: ConfigSummary): void {
  console.log("");
  console.log("SMTP Verification");
  console.log("=================");
  console.log(`  Source   : ${summary.source}`);
  console.log(`  Host     : ${summary.host}`);
  console.log(`  Port     : ${summary.port}`);
  console.log(`  Username : ${summary.username}`);
  console.log(`  Secure   : ${summary.secure}`);
  if (summary.fromAddress != null) {
    console.log(`  From     : ${summary.fromAddress}`);
  }
  console.log("");
}

function printResult(result: SmtpCheckResult): void {
  if (result.ok) {
    console.log("Result   : SUCCESS — SMTP server accepted the connection");
    console.log("");
    return;
  }

  console.log("Result   : FAILED");
  console.log(`  Error  : ${result.name} — ${result.message}`);

  if (result.code != null) {
    console.log(`  Code   : ${result.code}`);
  }
  if (result.command != null) {
    console.log(`  Command: ${result.command}`);
  }
  if (result.responseCode != null) {
    console.log(
      `  SMTP   : ${result.responseCode}${result.response != null ? ` ${result.response}` : ""}`,
    );
  }

  console.log("");
}

async function main(): Promise<void> {
  const scriptRoot = dirname(fileURLToPath(import.meta.url));
  const cli = parseCliArgs(process.argv.slice(2));
  const { smtp, summary } = await loadConfig(cli, scriptRoot);

  printSummaryHeader(summary);

  const result = await checkSmtp(smtp);

  printResult(result);

  if (!result.ok) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  if (error instanceof InvalidArgumentError) {
    // Our own validation errors — print the message so the user can act on it
    console.error(`Error: ${error.message}`);
    process.exitCode = error.exitCode;
  } else if (error instanceof CommanderError) {
    // Commander system errors (--help, --version, etc.) — already handled by Commander
    process.exitCode = error.exitCode;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
