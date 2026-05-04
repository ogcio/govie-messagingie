import {
  Alert,
  Container,
  Heading,
  Link,
  SectionBreak,
  Stack,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
} from "@ogcio/design-system-react"
import { redirect } from "next/navigation"
import { Suspense, use } from "react"
import AuthWrapper from "@/app/server-utils/AuthWrapper"
import { ProfileDataService } from "@/data/profile"
import type { NextSearchParams } from "@/data/types"
import { type ProfileLinkParams, UserRelationStatuses } from "@/data/types"
import { getIdentity } from "@/utils/session"
import { toURLSearchParams } from "@/utils/utils"
import { LinkingForms } from "./components/LinkingForm"
import { Unlink } from "./components/Unlink"
import "./page.css"
import { ProfileMeta } from "@/app/components/ProfileMeta"
import { UserTable } from "./components/UserTable"

export default function AccountLink(props: {
  params: Promise<{ userId: string }>
  searchParams: Promise<NextSearchParams>
}) {
  const searchParams = use(props.searchParams)
  const searchParamsString = toURLSearchParams(searchParams).toString()
  const params = use(props.params)

  const user = use(getIdentity())
  if (!user) {
    redirect("/auth/error")
  }

  const args: ProfileLinkParams = {
    type: "id",
    value: params.userId,
  }

  const userRelationStatusResult = use(
    ProfileDataService.getUserRelationStatus(args.value),
  )

  if (!userRelationStatusResult.success) {
    return <div>{userRelationStatusResult.userMessage}</div>
  }

  const parent =
    userRelationStatusResult.value.userIs === UserRelationStatuses.Child
      ? userRelationStatusResult.value.parent
      : undefined

  const children =
    userRelationStatusResult.value.userIs === UserRelationStatuses.Parent
      ? userRelationStatusResult.value.children
      : undefined

  return (
    <AuthWrapper>
      <Suspense>
        <Stack direction='column' gap={7}>
          <ProfileMeta
            place='Account linking'
            fullName={userRelationStatusResult.value.userData?.public_name}
            searchParamsString={searchParamsString}
          />
          <Stack direction={"row"} gap={20}>
            <Stack direction='column' gap={3}>
              <Heading as='h4'>Account</Heading>
              <UserTable userRelations={userRelationStatusResult.value} />
            </Stack>

            <Stack direction='column' gap={3}>
              {parent ? (
                <Heading as='h4'>Parent Account</Heading>
              ) : (
                <Heading as='h4'>Child Account(s)</Heading>
              )}
              <Table>
                <TableHead
                  style={{
                    backgroundColor:
                      "var(--gieds-color-surface-system-neutral-layer1)",
                  }}
                >
                  <TableRow>
                    <TableHeader>Name</TableHeader>
                    <TableHeader>Email</TableHeader>
                    <TableHeader size='sm-fixed'></TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userRelationStatusResult.value.userIs ===
                    UserRelationStatuses.Unlinked && (
                    <TableRow>
                      <TableData colSpan={10}>
                        <Container insetBottom='lg' insetTop='lg'>
                          <Alert variant='info'>No linked accounts</Alert>
                        </Container>
                      </TableData>
                    </TableRow>
                  )}
                  {parent ? (
                    <TableRow key={parent.id}>
                      <TableData>{parent.public_name}</TableData>
                      <TableData>{parent.email}</TableData>
                      <TableData>
                        <Unlink
                          profile={{
                            name: parent.public_name,
                            id: parent.id,
                            email: parent.email,
                            isPrimary: true,
                          }}
                          canonicalProfileId={
                            userRelationStatusResult.value.userData?.id
                          }
                        />
                      </TableData>
                    </TableRow>
                  ) : (
                    children?.map((child) => (
                      <TableRow key={child.id}>
                        <TableData>{child.public_name}</TableData>
                        <TableData>{child.email}</TableData>
                        <TableData>
                          <Unlink
                            profile={{
                              name: child.public_name,
                              id: child.id,
                              email: child.email,
                              isPrimary: false,
                            }}
                            canonicalProfileId={
                              userRelationStatusResult.value.userData?.id
                            }
                          />
                        </TableData>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Stack>
          </Stack>

          {/* Prevent children from seeing linking forms */}
          {userRelationStatusResult.value.userIs !==
            UserRelationStatuses.Child && (
            <>
              <SectionBreak size='md' />
              <LinkingForms
                toSetAsParentId={userRelationStatusResult.value.userData?.id}
              />
            </>
          )}
          <Link href={`/?${searchParamsString}`} iconStart='arrow_back'>
            Back
          </Link>
        </Stack>
      </Suspense>
    </AuthWrapper>
  )
}
