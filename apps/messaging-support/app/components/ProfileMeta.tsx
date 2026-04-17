import {
  Alert,
  BreadcrumbCurrentLink,
  BreadcrumbLink,
  Breadcrumbs,
  Heading,
  Paragraph,
  Stack,
} from "@ogcio/design-system-react"

export function ProfileMeta(props: {
  searchParamsString: string
  fullName: string
  place: string
  errorText?: string
}) {
  const { place, fullName, errorText } = props

  const breadcrumbLinks = [
    <BreadcrumbLink key='bc1' href={`/?${props.searchParamsString}`}>
      Home
    </BreadcrumbLink>,
    <BreadcrumbCurrentLink key='bc2' href=''>
      {fullName}
    </BreadcrumbCurrentLink>,
    <BreadcrumbCurrentLink key='bc3' href=''>
      {place}
    </BreadcrumbCurrentLink>,
  ]

  return (
    <Stack direction='column' gap={4}>
      <Breadcrumbs>{breadcrumbLinks}</Breadcrumbs>

      {errorText ? (
        <Alert variant='danger' title='Server Hiccup'>
          <Paragraph>{errorText}</Paragraph>
        </Alert>
      ) : (
        <Heading as='h1'>{fullName}</Heading>
      )}
    </Stack>
  )
}
