import {
  Alert,
  Container,
  Paragraph,
  TableData,
  TableRow,
  Tag,
} from "@ogcio/design-system-react"
import { redirect } from "next/navigation"
import { use } from "react"
import { emitAuditOnce } from "@/data/audit"
import { getMessages } from "@/data/messaging"
import { ProfileDataService } from "@/data/profile"
import type { NextSearchParams } from "@/data/types"
import { MessageEventStatusKey } from "@/utils/appliedFilter"
import { getIdentity } from "@/utils/session"

function FailRow(props: { message: string }) {
  return (
    <TableRow>
      <TableData colSpan={5}>
        <Container insetTop='md' insetBottom='md'>
          <Alert variant='danger' title='Server Hiccup'>
            <Paragraph>{props.message}</Paragraph>
          </Alert>
        </Container>
      </TableData>
    </TableRow>
  )
}

export function TableBodyRows(props: {
  profileId: string
  searchParams: NextSearchParams
}) {
  const user = use(getIdentity())
  if (!user) {
    redirect("/auth/error")
  }

  const profileIdsResult = use(
    ProfileDataService.getAssociatedProfileIds(props.profileId),
  )
  if (!profileIdsResult.success) {
    return <FailRow message={profileIdsResult.userMessage} />
  }

  const messagesResult = use(
    getMessages(profileIdsResult.value, props.searchParams),
  )

  void emitAuditOnce(
    {
      user,
      actionName: "getMessages",
      actionType: "list",
      args: Object.assign({}, props.searchParams, {
        profileId: props.profileId,
      }),
    },
    messagesResult.success ? undefined : messagesResult.error.message,
  )

  if (!messagesResult.success) {
    return <FailRow message={messagesResult.userMessage} />
  }

  const messages = messagesResult.value

  if (!messages.length) {
    return (
      <TableRow>
        <TableData colSpan={5}>No messages found</TableData>
      </TableRow>
    )
  }

  return messages.map((message) => (
    <TableRow key={message.id}>
      <TableData>{message.scheduledAt}</TableData>
      <TableData>
        <Tag
          text={message.messagingEventType}
          type={
            message.messagingEventStatus === MessageEventStatusKey.SUCCESSFUL
              ? "success"
              : "error"
          }
        ></Tag>
      </TableData>
      <TableData>
        {message.emailEventType && (
          <Tag
            text={message.emailEventType}
            type={
              message.emailEventStatus === MessageEventStatusKey.SUCCESSFUL
                ? "success"
                : "error"
            }
          ></Tag>
        )}
      </TableData>
      <TableData>{message.orgId}</TableData>
      <TableData>{message.subject}</TableData>
    </TableRow>
  ))
}
