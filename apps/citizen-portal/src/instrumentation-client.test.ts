import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { env, instrumentFaro, withReplay } = vi.hoisted(() => ({
  env: {
    NEXT_PUBLIC_FARO_URL: undefined as string | undefined,
    NEXT_PUBLIC_FARO_REPLAY_ENABLED: false,
    NEXT_PUBLIC_FARO_SERVICE_NAME: "citizen-portal",
    NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER: "gateway.test",
    NEXT_PUBLIC_FARO_SERVICE_NAMESPACE: "messaging",
    NEXT_PUBLIC_VERSION: "1.2.3",
    NEXT_PUBLIC_FARO_REPLAY_SAMPLING_RATE: 0.5,
  },
  instrumentFaro: vi.fn(),
  withReplay: vi.fn((config) => config),
}))

vi.mock("@/env/env.client", () => ({ env }))
vi.mock("@ogcio/o11y-sdk-react", () => ({ instrumentFaro }))
vi.mock("@ogcio/o11y-sdk-react/replay", () => ({ withReplay }))

describe("client instrumentation", () => {
  beforeEach(() => {
    env.NEXT_PUBLIC_FARO_URL = undefined
    env.NEXT_PUBLIC_FARO_REPLAY_ENABLED = false
    instrumentFaro.mockReset()
    withReplay.mockClear()
    vi.resetModules()
  })

  afterEach(() => vi.restoreAllMocks())

  it("does not initialise Faro without a collector", async () => {
    await import("./instrumentation-client")
    expect(instrumentFaro).not.toHaveBeenCalled()
  })

  it("initialises base tracing synchronously", async () => {
    env.NEXT_PUBLIC_FARO_URL = "https://faro.test"
    await import("./instrumentation-client")

    expect(instrumentFaro).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceName: "citizen-portal",
        collectorUrl: "https://faro.test",
        collectorMode: "batch",
        appMeta: {
          name: "citizen-portal",
          namespace: "messaging",
          version: "1.2.3",
        },
      }),
    )
  })

  it("adds replay configuration when enabled", async () => {
    env.NEXT_PUBLIC_FARO_URL = "https://faro.test"
    env.NEXT_PUBLIC_FARO_REPLAY_ENABLED = true
    await import("./instrumentation-client")
    await vi.waitFor(() => expect(withReplay).toHaveBeenCalledOnce())

    expect(withReplay).toHaveBeenCalledWith(
      expect.objectContaining({
        replay: { enabled: true, samplingRate: 0.5 },
      }),
    )
    expect(instrumentFaro).toHaveBeenCalledOnce()
  })

  it("does not let instrumentation errors break startup", async () => {
    const error = new Error("failed")
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    env.NEXT_PUBLIC_FARO_URL = "https://faro.test"
    instrumentFaro.mockImplementationOnce(() => {
      throw error
    })

    await import("./instrumentation-client")

    expect(consoleError).toHaveBeenCalledWith(
      "Faro client instrumentation failed to initialise",
      error,
    )
  })
})
