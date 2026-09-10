import { Suspense } from "react"
import { ServiceUserImport } from "@/components/profile-admin/service-users/service-user-import"

export { generateStaticParams } from "@/util/route-helpers"

export default function ServiceUserImportPage() {
  return (
    <Suspense>
      <ServiceUserImport />
    </Suspense>
  )
}
