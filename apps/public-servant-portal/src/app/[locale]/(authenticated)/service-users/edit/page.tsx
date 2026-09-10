import { Suspense } from "react"
import { EditServiceUser } from "@/components/profile-admin/service-users/edit-service-user"

export { generateStaticParams } from "@/util/route-helpers"

export default function EditServiceUserPage() {
  return (
    <Suspense>
      <EditServiceUser />
    </Suspense>
  )
}
