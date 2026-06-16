import { ClientShell } from "@/components/client-shell"

export { generateStaticParams } from "@/util/route-helpers"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ClientShell>{children}</ClientShell>
}
