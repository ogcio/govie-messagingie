#!/usr/bin/env node
/**
 * Run the consolidated citizen-portal Docker image locally.
 *
 * Wraps `docker run` with sensible defaults for the multi-zone (nginx
 * Host-based routing) image:
 *   - Maps the chosen host port to the container's nginx listener (8080).
 *   - Loads an env file from $ENV_FILE / `--env-file` and forwards it to
 *     `docker run --env-file`. Defaults to `apps/citizen-portal/.env.local`
 *     if it exists, otherwise no env file is passed.
 *   - Pre-wires `--add-host messaging|profile|dashboard.local.test:host-gateway`
 *     so the three zone hostnames resolve to the container without editing
 *     /etc/hosts.
 *   - Forwards SIGINT/SIGTERM so `Ctrl-C` cleanly stops the container.
 *
 * NOTE: The static-export builds inside the image bake `NEXT_PUBLIC_*` values
 * at BUILD time. Passing them via `--env-file` here is a no-op for the JS
 * bundles; use the env file with `docker build --build-arg` (or pipeline
 * variables) when you need different baked-in values.
 *
 * Choosing an env file — picking the path that doesn't fight your tool:
 *
 *   # 1) ENV_FILE env var (works everywhere, recommended):
 *   ENV_FILE=apps/citizen-portal/.env.local pnpm docker:run:citizen-portal:local
 *
 *   # 2) --env-file flag, but pnpm 10 and node 20+ both eat --env-file unless
 *   #    you separate it from their own argv parsing:
 *   pnpm docker:run:citizen-portal:local -- --env-file apps/citizen-portal/.env.local
 *
 *   # 3) Standalone (no pnpm): use node's -- to stop its own flag parsing:
 *   node -- scripts/dev/docker-run-citizen-portal.mjs --env-file apps/citizen-portal/.env.local
 */

import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = resolve(__dirname, "..", "..")

const DEFAULT_IMAGE = "citizen-portal:local"
const DEFAULT_PORT = "8080"
const DEFAULT_NAME = "citizen-portal-run"
const DEFAULT_ENV_FILE = join(REPO_ROOT, "apps", "citizen-portal", ".env.local")
const ZONE_HOSTS = [
  "messaging.local.test",
  "profile.local.test",
  "dashboard.local.test",
  // SAG runs on the host at sag.local.test:3333 so the browser-visible cookie
  // Domain=.local.test is shared across all 4 hosts (same registrable domain).
  // Added here for parity even though the nginx-only image doesn't fetch SAG
  // server-side; useful if a script ever execs inside the container to probe.
  "sag.local.test",
]

function printHelp() {
  console.log(`Usage:
  pnpm docker:run:citizen-portal:local [options]
  pnpm docker:run:citizen-portal:local -- --env-file <path>
  node -- scripts/dev/docker-run-citizen-portal.mjs [options]

Options:
  --image <tag>      Image to run (default: ${DEFAULT_IMAGE})
  --env-file <path>  Env file forwarded to docker run (see env-file selection below)
  --port <port>      Host port mapped to container 8080 (default: ${DEFAULT_PORT})
  --name <name>      Container name (default: ${DEFAULT_NAME})
  --build            Build the :local image first (pnpm docker:build:citizen-portal:local)
  --no-add-host      Skip the default --add-host entries for *.local.test
  --detach           Run detached (-d)
  -h, --help         Show this help

Env-file selection (highest priority first):
  1. $ENV_FILE
  2. --env-file <path>          (use 'pnpm <script> -- --env-file …' to avoid
                                  pnpm/node eating the flag)
  3. ${DEFAULT_ENV_FILE}
     (auto-detected if present)

Examples:
  pnpm docker:run:citizen-portal:local
  ENV_FILE=apps/citizen-portal/.env.local pnpm docker:run:citizen-portal:local
  pnpm docker:run:citizen-portal:local -- --env-file apps/citizen-portal/.env.local
  pnpm docker:run:citizen-portal:local --build --port 9090
`)
}

function parseArgs(argv) {
  const opts = {
    image: DEFAULT_IMAGE,
    envFile: null,
    envFileExplicit: false,
    port: DEFAULT_PORT,
    name: DEFAULT_NAME,
    build: false,
    addHost: true,
    detach: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    // pnpm/npm scripts may emit a bare `--` to separate forwarded user args;
    // skip it without consuming anything else.
    if (arg === "--") continue
    switch (arg) {
      case "-h":
      case "--help":
        printHelp()
        process.exit(0)
        break
      case "--image":
        opts.image = argv[++i]
        break
      case "--env-file":
        opts.envFile = argv[++i]
        opts.envFileExplicit = true
        break
      case "--port":
        opts.port = argv[++i]
        break
      case "--name":
        opts.name = argv[++i]
        break
      case "--build":
        opts.build = true
        break
      case "--no-add-host":
        opts.addHost = false
        break
      case "--detach":
      case "-d":
        opts.detach = true
        break
      default:
        console.error(
          `[docker-run-citizen-portal] unknown argument: ${arg}\nRun with --help for usage.`,
        )
        process.exit(2)
    }
  }

  // Priority: $ENV_FILE > --env-file > auto-detected default.
  if (process.env.ENV_FILE && process.env.ENV_FILE.length > 0) {
    opts.envFile = process.env.ENV_FILE
    opts.envFileExplicit = true
  }
  if (!opts.envFileExplicit && existsSync(DEFAULT_ENV_FILE)) {
    opts.envFile = DEFAULT_ENV_FILE
  }
  return opts
}

function resolveEnvFile(envFile) {
  if (!envFile) return null
  const abs = resolve(envFile)
  if (!existsSync(abs)) {
    console.error(
      `[docker-run-citizen-portal] env file does not exist: ${abs}`,
    )
    process.exit(1)
  }
  return abs
}

function buildImage() {
  console.log(
    "[docker-run-citizen-portal] building citizen-portal:local first...",
  )
  const result = spawnSync(
    "pnpm",
    ["docker:build:citizen-portal:local"],
    { cwd: REPO_ROOT, stdio: "inherit" },
  )
  if (result.status !== 0) {
    console.error("[docker-run-citizen-portal] build failed; aborting.")
    process.exit(result.status ?? 1)
  }
}

function buildDockerArgs(opts) {
  const args = ["run", "--rm"]
  if (opts.detach) args.push("-d")
  args.push("--name", opts.name)
  args.push("-p", `${opts.port}:8080`)
  if (opts.envFile) args.push("--env-file", opts.envFile)
  if (opts.addHost) {
    for (const host of ZONE_HOSTS) {
      args.push("--add-host", `${host}:host-gateway`)
    }
  }
  args.push(opts.image)
  return args
}

function run() {
  const opts = parseArgs(process.argv.slice(2))
  opts.envFile = resolveEnvFile(opts.envFile)

  if (opts.build) buildImage()

  const dockerArgs = buildDockerArgs(opts)
  console.log(`[docker-run-citizen-portal] docker ${dockerArgs.join(" ")}`)
  if (opts.envFile) {
    console.log(`[docker-run-citizen-portal] env file: ${opts.envFile}`)
  }
  if (!opts.detach) {
    console.log(
      `[docker-run-citizen-portal] hit http://${ZONE_HOSTS[0]}:${opts.port}/ (or profile.*, dashboard.*) — Ctrl-C to stop.`,
    )
  }

  const child = spawn("docker", dockerArgs, { stdio: "inherit" })

  const forward = (signal) => {
    spawnSync("docker", ["stop", opts.name], { stdio: "ignore" })
    if (!child.killed) child.kill(signal)
  }
  process.on("SIGINT", () => forward("SIGINT"))
  process.on("SIGTERM", () => forward("SIGTERM"))

  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal)
    else process.exit(code ?? 0)
  })
}

run()
