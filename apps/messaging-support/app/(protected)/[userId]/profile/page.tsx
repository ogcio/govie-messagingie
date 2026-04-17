import AuthWrapper from "@/app/server-utils/AuthWrapper"
import { ProfileDataService } from "@/data/profile"
import type { NextSearchParams } from "@/data/types"
import { getFullName, toURLSearchParams } from "@/utils/utils"
import { Link, Stack } from "@ogcio/design-system-react"
import { ConsentTables } from "./ConsentTables"
import { ProfileMeta } from "@/app/components/ProfileMeta"
import { ProfileTables } from "@/app/components/ProfileTables"

export default async function Profile(props: {
  params: Promise<{ userId: string }>
  searchParams: Promise<NextSearchParams>
}) {
  const searchParams = await props.searchParams

  const { userId } = await props.params
  const [consentsResult, profileResult] = await Promise.all([
    ProfileDataService.getConsents(userId),
    ProfileDataService.getMainProfile(userId),
  ])

  if (!consentsResult.success || !profileResult.success) {
    return null
  }

  const consents = consentsResult.value
  const profile = profileResult.value

  const searchParamsString = toURLSearchParams(searchParams).toString()

  return (
    <AuthWrapper>
      <Stack direction='column' gap={7}>
        <ProfileMeta
          place='Profile'
          searchParamsString={searchParamsString}
          fullName={getFullName(profile)}
        />
        <Stack direction={"row"} gap={20} style={{ flex: "1 1 320px" }}>
          <ProfileTables profile={profile} />

          <ConsentTables consents={consents} />
        </Stack>

        <Link href={`/?${searchParamsString}`} iconStart='arrow_back'>
          Back
        </Link>
      </Stack>
    </AuthWrapper>
  )
}
