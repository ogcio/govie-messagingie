import {
  Heading,
  Stack,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
  Tag,
} from "@ogcio/design-system-react"
import dayjs from "dayjs"
import type { Consent } from "@/data/types"

function capitalize(str: string): string {
  if (!str) {
    return ""
  }

  if (str.length === 1) {
    return str[0].toUpperCase()
  }

  return str[0].toUpperCase() + str.slice(1)
}

function consentTitleMap(subject: string) {
  switch (subject) {
    case "messaging":
      return "MessagingIE consent history"
    default:
      return `${capitalize(subject)} consent history`.trim()
  }
}

function statusTag(status: Consent["status"]) {
  switch (status) {
    case "pre-approved":
    case "opted-in":
      return <Tag text='Accepted' type='success' />
    case "opted-out":
      return <Tag text='Declined' type='error' />
    case "pending":
    case "undefined":
      return <Tag text='Pending' type='info' />
    default:
      return null
  }
}

export function ConsentTables(props: { consents: Consent[] }) {
  const groupedMap = new Map<string, Consent[]>()

  for (const consent of props.consents) {
    const key = consent.subject

    if (!groupedMap.has(key)) {
      groupedMap.set(key, [])
    }

    groupedMap.get(key)?.push(consent)
  }

  const grouped = Array.from(groupedMap, ([key, consents]) => ({
    key,
    consents,
  }))

  return (
    <>
      {grouped.map((stuff) => (
        <Stack key={stuff.key} direction='column' gap={3}>
          <Heading as='h4'>{consentTitleMap(stuff.key)}</Heading>
          <Stack direction='column' gap={7}>
            <Table layout='fixed'>
              <TableHead
                style={{
                  backgroundColor:
                    "var(--gieds-color-surface-system-neutral-layer1)",
                }}
              >
                <TableRow>
                  <TableHeader>Status</TableHeader>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Time</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.consents.map((consent) => {
                  const date = dayjs(consent.createdAt)

                  return (
                    <TableRow key={consent.id}>
                      <TableData>{statusTag(consent.status)}</TableData>
                      <TableData>
                        {date.isValid() && date.format("YYYY-MM-DD")}
                      </TableData>
                      <TableData>
                        {date.isValid() && date.format("HH:MM")}
                      </TableData>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Stack>
        </Stack>
      ))}
    </>
  )
}
