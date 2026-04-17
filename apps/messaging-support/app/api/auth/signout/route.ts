import { NextResponse } from "next/server"
import { cookieNameSession } from "@/utils/cookies"
import { getEnvConfig } from "@/utils/env"

export async function GET() {
  const { BASE_URL } = getEnvConfig()
  const res = NextResponse.redirect(BASE_URL)
  res.cookies.delete({ name: cookieNameSession, path: "/" })
  return res
}
