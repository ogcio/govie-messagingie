import { redirect } from "next/navigation"
import { requireSession } from "./session"

export default async function AuthWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireSession()
  if (!session) {
    redirect("/api/auth/signin")
  }

  return <>{children}</>
}
