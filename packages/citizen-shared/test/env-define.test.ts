import { afterEach, beforeEach, describe, expect, test } from "vitest"
import {
  defineZoneEnv,
  requiredInDevelopment,
  requiredInProduction,
  z,
} from "../src/env/define"

describe("defineZoneEnv", () => {
  test("re-exports a usable z so zones do not need a direct zod dep", () => {
    expect(typeof z.string).toBe("function")
    expect(typeof z.url).toBe("function")
    expect(typeof z.preprocess).toBe("function")
  })

  test("parses NEXT_PUBLIC_ vars from runtimeEnv and returns a typed env object", () => {
    const env = defineZoneEnv({
      client: {
        NEXT_PUBLIC_BASE_URL: z.url(),
        NEXT_PUBLIC_VERSION: z.string().default("0.0.0"),
      },
      runtimeEnv: {
        NEXT_PUBLIC_BASE_URL: "https://messaging.example.test",
      },
    })
    expect(env.NEXT_PUBLIC_BASE_URL).toBe("https://messaging.example.test")
    expect(env.NEXT_PUBLIC_VERSION).toBe("0.0.0")
  })

  test("throws via @t3-oss/env-nextjs when a required var is missing and no default is set", () => {
    expect(() =>
      defineZoneEnv({
        client: { NEXT_PUBLIC_REQUIRED: z.url() },
        runtimeEnv: { NEXT_PUBLIC_REQUIRED: undefined },
      }),
    ).toThrow(/Invalid environment variables/i)
  })
})

describe("requiredInProduction", () => {
  const originalNodeEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  test("flags missing var when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production"
    const schema = z.string().optional().superRefine(requiredInProduction)
    const result = schema.safeParse(undefined)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/production/i)
    }
  })

  test("does not flag missing var outside production", () => {
    process.env.NODE_ENV = "development"
    const schema = z.string().optional().superRefine(requiredInProduction)
    expect(schema.safeParse(undefined).success).toBe(true)
  })

  test("does not flag when var is present in production", () => {
    process.env.NODE_ENV = "production"
    const schema = z.string().optional().superRefine(requiredInProduction)
    expect(schema.safeParse("https://faro.example.test").success).toBe(true)
  })
})

describe("requiredInDevelopment", () => {
  const originalNodeEnv = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  test("flags missing var when NODE_ENV is development", () => {
    process.env.NODE_ENV = "development"
    const schema = z.string().optional().superRefine(requiredInDevelopment)
    const result = schema.safeParse(undefined)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/development/i)
    }
  })

  test("does not flag when NODE_ENV is production", () => {
    process.env.NODE_ENV = "production"
    const schema = z.string().optional().superRefine(requiredInDevelopment)
    expect(schema.safeParse(undefined).success).toBe(true)
  })
})

describe("env helper integration smoke", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_FAKE_BASE_URL = "https://test.local.test"
    process.env.NEXT_PUBLIC_FAKE_OPTIONAL = ""
  })
  afterEach(() => {
    process.env.NEXT_PUBLIC_FAKE_BASE_URL = undefined
    process.env.NEXT_PUBLIC_FAKE_OPTIONAL = undefined
  })

  test("mirrors the shape a zone would use without direct zod / env-nextjs deps", () => {
    const env = defineZoneEnv({
      client: {
        NEXT_PUBLIC_FAKE_BASE_URL: z.url(),
        NEXT_PUBLIC_FAKE_OPTIONAL: z.preprocess(
          (v) => (v === "" ? undefined : v),
          z.url().optional(),
        ),
      },
      runtimeEnv: {
        NEXT_PUBLIC_FAKE_BASE_URL: process.env.NEXT_PUBLIC_FAKE_BASE_URL,
        NEXT_PUBLIC_FAKE_OPTIONAL: process.env.NEXT_PUBLIC_FAKE_OPTIONAL,
      },
    })
    expect(env.NEXT_PUBLIC_FAKE_BASE_URL).toBe("https://test.local.test")
    expect(env.NEXT_PUBLIC_FAKE_OPTIONAL).toBeUndefined()
  })
})
