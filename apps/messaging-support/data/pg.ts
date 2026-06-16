import { readFileSync } from "node:fs"
import { Pool } from "pg"
import { getEnvConfig } from "@/utils/env"
import { logger } from "./logger"
import { buildSslConfig, isSslEnabled, resolveCaCertPath } from "./ssl"

const {
  POSTGRES_MESSAGING_DATABASE,
  POSTGRES_MESSAGING_HOST,
  POSTGRES_MESSAGING_PASSWORD,
  POSTGRES_MESSAGING_PORT,
  POSTGRES_MESSAGING_USER,
  POSTGRES_MESSAGING_SSL,
  POSTGRES_PROFILE_DATABASE,
  POSTGRES_PROFILE_HOST,
  POSTGRES_PROFILE_PASSWORD,
  POSTGRES_PROFILE_PORT,
  POSTGRES_PROFILE_USER,
  POSTGRES_PROFILE_SSL,
} = getEnvConfig()

const messagingSslEnabled = isSslEnabled(POSTGRES_MESSAGING_SSL)
const profileSslEnabled = isSslEnabled(POSTGRES_PROFILE_SSL)

// Read the CA bundle once, only if at least one pool needs SSL.
const ca =
  messagingSslEnabled || profileSslEnabled
    ? readFileSync(resolveCaCertPath(process.cwd()))
    : Buffer.alloc(0)

export const profilePool = new Pool({
  password: POSTGRES_PROFILE_PASSWORD,
  host: POSTGRES_PROFILE_HOST,
  port: Number(POSTGRES_PROFILE_PORT),
  user: POSTGRES_PROFILE_USER,
  database: POSTGRES_PROFILE_DATABASE,
  ssl: buildSslConfig(profileSslEnabled, ca),
  options: "-c default_transaction_read_only=on",
})

profilePool.on("connect", () => {
  logger.info("Profile pg client connected with read-only mode")
})

export const messagePool = new Pool({
  password: POSTGRES_MESSAGING_PASSWORD,
  host: POSTGRES_MESSAGING_HOST,
  port: Number(POSTGRES_MESSAGING_PORT),
  user: POSTGRES_MESSAGING_USER,
  database: POSTGRES_MESSAGING_DATABASE,
  ssl: buildSslConfig(messagingSslEnabled, ca),
  options: "-c default_transaction_read_only=on",
})

messagePool.on("connect", () => {
  logger.info("Messaging pg client connected with read-only mode")
})
