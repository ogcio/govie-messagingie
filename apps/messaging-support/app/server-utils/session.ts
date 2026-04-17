import { type JWTPayload, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { cookieNameSession } from "@/utils/cookies"
import { getEnvConfig } from "@/utils/env"

export async function requireSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(cookieNameSession)?.value
  if (!sessionCookie) {
    return null
  }

  try {
    const { COOKIE_SECRET } = getEnvConfig()
    const { payload } = await jwtVerify(
      sessionCookie,
      new TextEncoder().encode(COOKIE_SECRET),
    )
    return payload
  } catch (_err) {
    return null
  }
}
