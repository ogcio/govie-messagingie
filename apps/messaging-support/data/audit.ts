import { cache as reactCache } from "react"
import { getEnvConfig } from "@/utils/env"
import { getSupportSdk, type SupportSdks } from "./sdk"
import type { SessionUser } from "./types"

type AuditLogBody = Parameters<
  SupportSdks["auditCollector"]["sendLogs"]
>[0][number]

const getAuditLedger = reactCache(() => new Set<string>())

function buildAuditKey(params: {
  user: SessionUser
  actionName: string
  args: unknown
}) {
  // For simplicity sake, goal is a request-safe key
  return JSON.stringify(params)
}

export async function emitAuditOnce(
  params: {
    user: SessionUser
    actionName: string
    args: Record<string, unknown>
    actionType: AuditLogBody["action_type"]
  },
  error?: string,
) {
  const ledger = getAuditLedger()
  const key = buildAuditKey(params)

  if (ledger.has(key)) {
    return
  }

  ledger.add(key)

  const { user, actionName, args } = params
  const metadata = { user, actionName, args }
  const auditSdk = getSupportSdk(getEnvConfig()).auditCollector

  void auditSdk
    .sendLogs([
      {
        action_type: "list",
        application_id: "messaging-support",
        client_timestamp: new Date().toISOString(),
        metadata,
        resource_type: "users",
        successful: !error,
        failure_reason: error,
        user_email_address: user.email,
      },
    ])
    .catch(() => {})
}
