import { TableData, TableRow } from "@ogcio/design-system-react"
import dayjs from "dayjs"
import { redirect } from "next/navigation"
import { Fragment, use } from "react"
import { emitAuditOnce } from "@/data/audit"
import { ProfileDataService } from "@/data/profile"
import type { NextSearchParams } from "@/data/types"
import { getIdentity } from "@/utils/session"
import { PopoverLinks } from "./PopoverLinks"

export function TableBodyRows(props: { searchParams: NextSearchParams }) {
  const searchParams = props.searchParams
  const user = use(getIdentity())
  if (!user) {
    redirect("/auth/error")
  }

  const profilesResult = use(ProfileDataService.getProfilesSdk(searchParams))

  void emitAuditOnce(
    { user, actionName: "getProfiles", actionType: "list", args: searchParams },
    profilesResult.success ? undefined : profilesResult.error.message,
  )

  if (!profilesResult.success) {
    return (
      <TableRow>
        <TableData colSpan={11}>{profilesResult.userMessage}</TableData>
      </TableRow>
    )
  }
  const profiles = profilesResult.value

  if (!profiles.length) {
    return (
      <TableRow>
        <TableData colSpan={11}>No profiles found</TableData>
      </TableRow>
    )
  }

  return profiles.map((profile, i) => {
    const compositeName =
      `${profile.data.firstName ?? ""} ${profile.data.lastName ?? ""}`.trim()
    const fullName =
      compositeName === "" ? profile.data.publicName : compositeName

    return (
      <Fragment key={`frg_${profile.id}${i}`}>
        <TableRow
          style={{
            background:
              profile.organisation_id || profile.primary_user_id !== profile.id
                ? "hsla(225, 9%, 99%, 1.00)"
                : undefined,
          }}
          key={`${profile.id}${i}`}
        >
          <TableData>{profile.id}</TableData>
          <TableData>
            {profile.id === profile.primary_user_id
              ? ""
              : profile.primary_user_id}
          </TableData>
          <TableData>{profile.organisation_id}</TableData>
          <TableData>{fullName}</TableData>
          <TableData>{profile.data?.email}</TableData>
          <TableData>{profile.data?.ppsn}</TableData>
          <TableData>{profile.data?.dateOfBirth}</TableData>
          <TableData>
            {profile.logtoUserRoles.map((r) => r.name).join(", ")}
          </TableData>
          <TableData>
            {profile.logtoUser?.lastSignInAt &&
              dayjs(profile.logtoUser?.lastSignInAt).format(
                "DD MMM YYYY, HH:mm",
              )}
          </TableData>
          <TableData>
            <PopoverLinks profileId={profile.id} />
          </TableData>
        </TableRow>
      </Fragment>
    )
  })
}
