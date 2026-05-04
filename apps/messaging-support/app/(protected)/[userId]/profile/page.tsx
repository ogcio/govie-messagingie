import {
  Heading,
  Link,
  Paragraph,
  SectionBreak,
  Stack,
} from "@ogcio/design-system-react"
import { AnalyticsViewEventHandler } from "@/app/components/AnalyticsViewEventHandler"
import { ProfileMeta } from "@/app/components/ProfileMeta"
import { ProfileTables } from "@/app/(protected)/[userId]/profile/ProfileTables"
import AuthWrapper from "@/app/server-utils/AuthWrapper"
import { ANALYTICS } from "@/const/analytics"
import { ProfileDataService } from "@/data/profile"
import type { NextSearchParams } from "@/data/types"
import { getIdentity } from "@/utils/session"
import { getFullName, toURLSearchParams } from "@/utils/utils"
import { AlreadyDeletedAccountSection } from "./AlreadyDeleteAccountSection"
import { ConsentTables } from "./ConsentTables"
import { DeleteAccountSection } from "./DeleteAccountSection"
import { ConsentManagement } from "./ConsentManagement"
import "./overrides.css"

export default async function Profile(props: {
  params: Promise<{ userId: string }>
  searchParams: Promise<NextSearchParams>
}) {
  const sessionUser = await getIdentity()
  if (!sessionUser) {
    return null
  }

  const searchParams = await props.searchParams

  const { userId } = await props.params
  const [consentsResult, profileResult, consentData] = await Promise.all([
    ProfileDataService.getConsents(userId),
    ProfileDataService.getMainProfile(userId),
    ProfileDataService.getLatestConsentData(userId),
  ])

  if (!consentsResult.success || !profileResult.success) {
    return null
  }

  const consents = consentsResult.value
  const profile = profileResult.value
  const isProfileActive = profile.status === "active"
  const searchParamsString = toURLSearchParams(searchParams).toString()

  return (
    <AuthWrapper>
      <AnalyticsViewEventHandler
        event={{
          name: ANALYTICS.profile.view.name,
          category: ANALYTICS.profile.category,
          action: ANALYTICS.profile.view.action,
        }}
      >
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

          <SectionBreak size='md' />

          <ConsentManagement consentData={consentData} profileId={profile.id} />

          <SectionBreak size='md' />

          <Stack direction='column' gap={3}>
            <Heading as='h4'>Delete Account</Heading>
            <Paragraph size='sm'>
              All account profile data and sessions will be deleted along with
              any links to organisations or data stored separately by PSBs.
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
      </AnalyticsViewEventHandler>
    </AuthWrapper>
  )
}
