import type { Logger } from "./types"

export const withErrorLogging = <TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult> | TResult,
  { logger, name }: { logger?: Logger; name?: string } = {},
): ((...args: TArgs) => Promise<TResult>) => {
  const wrapped = async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args)
    } catch (error: unknown) {
      const resolvedLogger = logger
      if (resolvedLogger) {
        resolvedLogger.error({ error }, name ?? fn.name ?? "anonymous")
      }
      throw error
    }
  }
  return wrapped
}
