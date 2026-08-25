/**
 * Production guards for the reproduce-export-leak operator task.
 *
 * This script mutates real data (uploads files, sends messages, injects a
 * cross-user file share and triggers a data export). It must NEVER run against
 * a production environment. The guards below mirror the `assertDevEnvironment()`
 * idea from `seed-citizen-messages.ts` but extend it to also inspect every
 * resolved host and to require an explicit operator confirmation.
 */

const PROD_PATTERN = /prod|prd/iu;

export function isProductionLikeValue(value: string): boolean {
  return PROD_PATTERN.test(value);
}

/**
 * Refuse to run when NODE_ENV signals production. Production container images
 * set NODE_ENV=production; locally it is unset or "development".
 */
export function assertNodeEnvNotProduction(env: NodeJS.ProcessEnv): void {
  const nodeEnv = (env.NODE_ENV ?? "").toLowerCase();

  if (nodeEnv === "production") {
    throw new Error(
      `Refusing to run reproduce-export-leak with NODE_ENV="${env.NODE_ENV ?? ""}". ` +
        "This task is for dev/uat only.",
    );
  }
}

/**
 * Refuse to run when the requested environment label or any resolved host looks
 * production-like (contains "prod" or "prd").
 */
export function assertEnvironmentNotProduction(params: {
  environmentLabel: string;
  hosts: readonly string[];
}): void {
  if (isProductionLikeValue(params.environmentLabel)) {
    throw new Error(
      `Refusing to run: environment "${params.environmentLabel}" looks production-like. ` +
        "This task is for dev/uat only.",
    );
  }

  for (const host of params.hosts) {
    if (isProductionLikeValue(host)) {
      throw new Error(
        `Refusing to run: host "${host}" looks production-like. ` +
          "This task is for dev/uat only.",
      );
    }
  }
}

/**
 * Require an explicit confirmation before any mutating action. The operator
 * must pass `--yes` on the command line or set `REPRO_CONFIRM=yes`.
 */
export function assertMutationConfirmed(params: {
  confirm: boolean;
  env: NodeJS.ProcessEnv;
  action: string;
}): void {
  const envConfirm = (params.env.REPRO_CONFIRM ?? "").trim().toLowerCase();
  const confirmed = params.confirm || envConfirm === "yes";

  if (!confirmed) {
    throw new Error(
      `Refusing to ${params.action} without explicit confirmation. ` +
        "Re-run with --yes (or set REPRO_CONFIRM=yes) once you have verified the target is dev/uat.",
    );
  }
}
