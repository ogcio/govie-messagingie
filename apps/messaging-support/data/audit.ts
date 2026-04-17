import { cache as reactCache } from "react"
import { getEnvConfig } from "@/utils/env"
import { AppHttp } from "./http"
import type { Result, SessionUser } from "./types"
import { failure, success } from "./utils"

type AuditLogBody = {
  application_version?: string
  user_id?: string
  user_email_address?: string
  resource_id?: string
  successful?: boolean
  failure_reason?: string
  server_id?: string
  parent_log_entry_id?: string
  application_id: string
  action_type: "read" | "create" | "update" | "delete" | "list"
  resource_type: string
  client_timestamp: string
  metadata: Record<string, unknown>
}

export async function fetchPostAudit(params: {
  bearerToken: string
  body: AuditLogBody[]
}): Promise<Result<void>> {
  try {
    const { bearerToken, body } = params
    const { AUDIT_API_URL } = getEnvConfig()
    const res = await fetch(new URL("/api/v1/audit-logs", AUDIT_API_URL), {
      body: JSON.stringify(body),
      method: "POST",
      headers: {
        Authorization: `Bearer ${bearerToken}`,
        "Content-Type": "application/json",
      },
    })

    if (!res.ok) {
      const errorText = await res.text().catch(() => "no body")
      return failure(
        new Error(errorText),
        `received status ${res.status} - expected 201`,
      )
    }

    return success(undefined)
  } catch (err) {
    return failure(err, "failed to post audit log")
  }
}

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
  const tokenResult = await AppHttp.fetchAppM2MToken()
  if (!tokenResult.success) {
    return
  }

  void fetchPostAudit({
    bearerToken: tokenResult.value,
    body: [
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
    ],
  }).catch()
}
