import {
  Alert,
  Container,
  Heading,
  Stack,
  Table,
  TableBody,
  TableData,
  TableHead,
  TableHeader,
  TableRow,
} from "@ogcio/design-system-react"
import { Suspense, use } from "react"
import { getProfileFilterOptions } from "@/utils/actions"
import AuthWrapper from "../server-utils/AuthWrapper"
import Filter from "./Filter"
import { TableBodyRows } from "./TableBodyRows"

export default function Home(props: {
  searchParams: Promise<Record<string, string | string[]>>
}) {
  const searchParams = use(props.searchParams)
  const filterKeyOptions = use(getProfileFilterOptions())

  const hasSearchParams = Boolean(Object.keys(searchParams).length)

  return (
    <AuthWrapper>
      <Stack gap={7}>
        <Heading as='h1'>Messaging Support</Heading>
        <Filter keyOptions={filterKeyOptions}></Filter>
        <Table>
          <TableHead
            style={{
              backgroundColor:
                "var(--gieds-color-surface-system-neutral-layer1)",
            }}
          >
            <TableRow>
              <TableHeader>Profile ID</TableHeader>
              <TableHeader>Parent ID</TableHeader>
              <TableHeader>Org ID</TableHeader>
              <TableHeader>Full Name</TableHeader>
              <TableHeader>Email</TableHeader>
              <TableHeader>PPSN</TableHeader>
              <TableHeader>DOB</TableHeader>
              <TableHeader>Logto Roles</TableHeader>
              <TableHeader>Last login date</TableHeader>
              <TableHeader align='center'>Links</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            <Suspense
              fallback={
                <TableRow>
                  <TableData colSpan={11}>Loading…</TableData>
                </TableRow>
              }
            >
              {hasSearchParams ? (
                <TableBodyRows searchParams={searchParams}></TableBodyRows>
              ) : (
                <TableRow>
                  <TableData colSpan={10}>
                    <Container insetBottom='lg' insetTop='lg'>
                      <Alert variant='info' title='No search performed'>
                        Use the filters above to start your search.
                      </Alert>
                    </Container>
                  </TableData>
                </TableRow>
              )}
            </Suspense>
          </TableBody>
        </Table>
      </Stack>
    </AuthWrapper>
  )
}
