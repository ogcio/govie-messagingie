import AuthWrapper from "@/app/server-utils/AuthWrapper"
import {
  Caption,
  Heading,
  Link,
  Paragraph,
  SectionBreak,
  Stack,
} from "@ogcio/design-system-react"
import { ProfileDataService } from "@/data/profile"
import type { NextSearchParams } from "@/data/types"
import { getFullName, toURLSearchParams } from "@/utils/utils"
import { ProfileMeta } from "@/app/components/ProfileMeta"
import { ProfileTables } from "@/app/components/ProfileTables"
import { getIdentity } from "@/utils/session"
import { DeleteAccountSection } from "./DeleteAccountSection"
import { AlreadyDeletedAccountSection } from "./AlreadyDeleteAccountSection"

export default async function Profile(props: {
  params: Promise<{ userId: string }>
  searchParams: Promise<NextSearchParams>
}) {
  const searchParams = await props.searchParams
  const sessionUser = await getIdentity()
  if (!sessionUser) {
    return null
  }

  const { userId } = await props.params
  const profileResult = await ProfileDataService.getMainProfile(userId)

  if (!profileResult.success) {
    return null
  }

  const profile = profileResult.value
  const isProfileActive = profile.status === "active"

  const searchParamsString = toURLSearchParams(searchParams).toString()

  return (
    <AuthWrapper>
      <Stack direction='column' gap={7}>
        <ProfileMeta
          place='Account management'
          fullName={getFullName(profile)}
          searchParamsString={searchParamsString}
        />

        <ProfileTables profile={profile} />

        <SectionBreak size='md' />

        <Stack direction='column' gap={3}>
          <Heading as='h4'>Delete Account</Heading>
          <Paragraph size='sm'>
            All account profile data and sessions will be deleted along with any
            links to organisations or data stored separately by PSBs.
          </Paragraph>

          {isProfileActive && (
            <DeleteAccountSection profile={profile} user={sessionUser} />
          )}

          {!isProfileActive && (
            <AlreadyDeletedAccountSection profile={profile} />
          )}
        </Stack>
        <Link href={`/?${searchParamsString}`} iconStart='arrow_back'>
          Back
        </Link>
      </Stack>
    </AuthWrapper>
  )
}
