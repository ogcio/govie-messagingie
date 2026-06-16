#!/usr/bin/env node
/**
 * Re-seed the LOCAL Logto container with redirect URIs pointed at
 * `*.local.test:8080` so the citizen-portal docker compose stack
 * (docker-compose.yaml + docker-compose.local-auth.yaml) has a
 * fully-functional auth chain without VPN.
 *
 * The OGCIO fork of Logto ships a `node ./node_modules/@logto/cli/bin/logto.js db ogcio`
 * sub-command that reads every `SEEDER_*` env var and creates/updates
 * the matching application registrations. This script exec()s that
 * inside the running `citizen-portal-logto` container with the local
 * triple substituted in.
 *
 * Idempotent: re-running it patches the existing rows rather than
 * appending duplicates. Safe to call from CI between test runs.
 *
 * Usage:
 *   node scripts/dev/seed-local-logto.mjs
 *
 * Or via pnpm (see package.json `seed:local-logto`):
 *   pnpm seed:local-logto
 *
 * Environment:
 *   LOGTO_CONTAINER_NAME — override the docker container name
 *     (defaults to `citizen-portal-logto` as set by
 *     docker-compose.local-auth.yaml).
 *   SEEDER_FILE_NAME — override the OGCIO seeder fixture
 *     (defaults to `ogcio-seeder-testing`).
 */

import { spawnSync } from "node:child_process"
import process from "node:process"

const CONTAINER = process.env.LOGTO_CONTAINER_NAME ?? "citizen-portal-logto"
const SEEDER_FILE = process.env.SEEDER_FILE_NAME ?? "ogcio-seeder-testing"

/**
 * Local-host triple — mirrors the SEEDER_* table in
 * logto-k8s-apps/logto/overlays/non-prod-02/dev/logto-config-map.env
 * with every `.dev.services.gov.ie` host swapped for `.local.test:8080`.
 *
 * Keep this list in lockstep with the env block in
 * `apps/citizen-portal/docker-compose.local-auth.yaml` — the compose
 * file passes these at container boot, this script patches them on
 * the running container. Either path must produce the same set of
 * registrations.
 */
const SEEDER_ENV = {
  ENDPOINT: "http://authorization.local.test:8080",
  ADMIN_ENDPOINT: "http://authorization-admin.local.test:8080",

  SEEDER_SAG_REDIRECT_URI:
    "http://secure-api-gateway.local.test:8080/auth/callback",
  SEEDER_SAG_LOGOUT_REDIRECT_URI:
    "http://secure-api-gateway.local.test:8080/auth/post-sign-out",

  SEEDER_MESSAGING_APP_REDIRECT_URI:
    "http://messaging.local.test:8080/api/callback",
  SEEDER_MESSAGING_APP_REDIRECT_URI_LEGACY:
    "http://messaging.local.test:8080/callback",
  SEEDER_MESSAGING_APP_LOGOUT_REDIRECT_URI: "http://messaging.local.test:8080",
  SEEDER_MESSAGING_APP_ADMIN_LOGOUT_REDIRECT_URI:
    "http://messaging.local.test:8080/admin",

  SEEDER_PROFILE_APP_REDIRECT_URI: "http://profile.local.test:8080/callback",
  SEEDER_PROFILE_APP_REDIRECT_URI_LEGACY:
    "http://profile.local.test:8080/api/callback",
  SEEDER_PROFILE_APP_LOGOUT_REDIRECT_URI: "http://profile.local.test:8080",

  SEEDER_DASHBOARD_APP_REDIRECT_URI:
    "http://dashboard.local.test:8080/callback",
  SEEDER_DASHBOARD_APP_LOGOUT_REDIRECT_URI: "http://dashboard.local.test:8080",

  SEEDER_MESSAGING_API_INDICATOR: "http://messaging-api.local.test:8080/",
  SEEDER_PROFILE_API_INDICATOR: "http://profile-api.local.test:8080/",

  SEEDER_MYGOVID_CONNECTOR_TOKEN_ENDPOINT:
    "http://mygovid-mock-service:4005/mock/mygovid/token",
  SEEDER_MYGOVID_CONNECTOR_AUTHORIZATION_ENDPOINT:
    "http://mygovid-mock-service:4005/mock/mygovid/auth",
  SEEDER_MYGOVID_CONNECTOR_JWS_URI:
    "http://mygovid-mock-service:4005/mock/mygovid/keys",
  SEEDER_MYGOVID_CONNECTOR_CLIENT_ID: "mock_client_id",

  SEEDER_PROFILE_PRIVACY_POLICY_URL:
    "http://profile.local.test:8080/en/privacy-policy",
  SEEDER_PROFILE_TERMS_OF_USE_URL:
    "http://profile.local.test:8080/en/terms-of-use",

  SEEDER_FILE_NAME: SEEDER_FILE,
}

function fail(message) {
  console.error(`[seed-local-logto] ${message}`)
  process.exit(1)
}

function assertContainerRunning() {
  // `docker ps` returns the names of running containers; an empty
  // match means the local-auth stack isn't up. A clear early error
  // here saves the user a confusing "exec failed" deeper in.
  const ps = spawnSync(
    "docker",
    ["ps", "--filter", `name=^${CONTAINER}$`, "--format", "{{.Names}}"],
    { encoding: "utf8" },
  )
  if (ps.status !== 0) {
    fail(
      "docker is not available — install Docker Desktop or wire docker into PATH.",
    )
  }
  if (!ps.stdout.split("\n").some((name) => name.trim() === CONTAINER)) {
    fail(
      `container '${CONTAINER}' is not running. Start the local-auth stack first:\n` +
        `  cd apps/citizen-portal && \\\n` +
        `    docker compose -f docker-compose.yaml -f docker-compose.local-auth.yaml up -d`,
    )
  }
}

function seed() {
  // Build the `-e KEY=VAL` flags inline rather than relying on the
  // container's existing env — that lets the script seed a Logto
  // container started WITHOUT the SEEDER_* envs (e.g. a vanilla
  // `svhd/logto:latest` image), which is the common case for users
  // who don't want to template the compose file.
  const envFlags = Object.entries(SEEDER_ENV).flatMap(([k, v]) => [
    "-e",
    `${k}=${v}`,
  ])

  // The OGCIO fork's seeder fixture path:
  //   ./packages/cli/src/commands/database/ogcio/${SEEDER_FILE_NAME}.json
  // The path is relative to the @logto/cli package install root inside
  // the container.
  const cli = "node"
  const cliArgs = [
    "./node_modules/@logto/cli/bin/logto.js",
    "db",
    "ogcio",
    "--",
    `--seeder-filepath=./packages/cli/src/commands/database/ogcio/${SEEDER_FILE}.json`,
  ]

  const args = ["exec", ...envFlags, CONTAINER, cli, ...cliArgs]

  console.log(
    `[seed-local-logto] running 'docker exec ${CONTAINER} ${cli} ${cliArgs.join(" ")}'`,
  )
  const exec = spawnSync("docker", args, { stdio: "inherit" })
  if (exec.status !== 0) {
    fail(
      `seeder failed with exit code ${exec.status}. ` +
        `Check the container logs: docker logs ${CONTAINER}`,
    )
  }
  console.log(
    "[seed-local-logto] done — local Logto seeded against *.local.test:8080",
  )
}

assertContainerRunning()
seed()
