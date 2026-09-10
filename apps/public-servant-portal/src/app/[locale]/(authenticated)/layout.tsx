import { AuthenticatedShellDispatcher } from "@/components/authenticated-shell-dispatcher"

export { generateStaticParams } from "@/util/route-helpers"

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AuthenticatedShellDispatcher>{children}</AuthenticatedShellDispatcher>
}
