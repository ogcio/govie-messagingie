import o11y from "@ogcio/nextjs-o11y"
import { type NextRequest, NextResponse } from "next/server"

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/auth")) {
    return NextResponse.next() // pass through untouched
  }
  const response = NextResponse.next({
    request,
  })

  o11y(request, response)

  return response
}
