import { faro } from "@grafana/faro-web-sdk"

export const withFaroSpan = async <T>(
  spanName: string,
  attributes: Record<string, string>,
  fn: () => Promise<T>,
): Promise<T> => {
  const faroOTEL = faro.api.getOTEL()
  if (!faroOTEL) {
    return fn()
  }

  const { trace, context } = faroOTEL
  const tracer = trace.getTracer("default")
  const span = tracer.startSpan(spanName)

  return context.with(trace.setSpan(context.active(), span), async () => {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value)
    }
    try {
      return await fn()
    } finally {
      span.end()
    }
  })
}
