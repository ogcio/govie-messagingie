import "server-only"
import { decodeJwt } from "jose"
import { cookies } from "next/headers"
import { cache as reactCache } from "react"

export const getIdentity = reactCache(async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("session")?.value
  if (!token) {
    return null
  }
  try {
    const payload = decodeJwt(token)

    return {
      sub: payload.sub as string,
      name: payload.name as string,
      email: payload.email as string,
    }
  } catch (err) {
    console.error(
      "failed to get identity (logged in user from session token)",
      err,
    )
    return null
  }
})
