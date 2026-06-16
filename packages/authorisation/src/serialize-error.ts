/**
 * Build a log-safe view of an unknown error value.
 *
 * Pino logs the full property bag of any object passed in bindings, which can
 * leak sensitive context for arbitrary thrown values: stack traces (file paths,
 * line numbers, internal symbol names), cause chains, axios `response.data`
 * payloads (tokens, request/response bodies), Logto SDK error metadata, etc.
 *
 * `serializeErrorForLog` returns an explicit field whitelist so logs stay
 * operationally useful (name, message, http status, error code) without
 * dumping unbounded internals (CWE-532).
 *
 * - `stack` is intentionally omitted; surface it via APM / tracing instead.
 * - `cause` is included only when it is itself an `Error`, and only its
 *   `name` and `message` are kept (no deeper recursion).
 */
export type SerializedErrorForLog = {
  name: string
  message: string
  code?: string
  statusCode?: number
  cause?: { name: string; message: string }
}

export function serializeErrorForLog(error: unknown): SerializedErrorForLog {
  if (error instanceof Error) {
    const out: SerializedErrorForLog = {
      name: error.name,
      message: error.message,
    }

    const code = (error as { code?: unknown }).code
    if (typeof code === "string") {
      out.code = code
    }

    const statusCode = (error as { statusCode?: unknown }).statusCode
    if (typeof statusCode === "number" && Number.isFinite(statusCode)) {
      out.statusCode = statusCode
    } else {
      const status = (error as { status?: unknown }).status
      if (typeof status === "number" && Number.isFinite(status)) {
        out.statusCode = status
      }
    }

    const cause = (error as { cause?: unknown }).cause
    if (cause instanceof Error) {
      out.cause = { name: cause.name, message: cause.message }
    }

    return out
  }

  if (typeof error === "string") {
    return { name: "UnknownError", message: error }
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return {
      name: "UnknownError",
      message: (error as { message: string }).message,
    }
  }

  return { name: "UnknownError", message: String(error) }
}
