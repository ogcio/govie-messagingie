import { Suspense } from "react"
import { ServiceUser } from "@/components/profile-admin/service-users/service-user"

export { generateStaticParams } from "@/util/route-helpers"

export default function ServiceUserDetailPage() {
  return (
    <Suspense>
      <ServiceUser />
    </Suspense>
  )
}
