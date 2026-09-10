import { FormField, Select, SelectItem } from "@ogcio/design-system-react"
import { FullWidthContainer } from "@/components/containers"

export const OrganizationSelector = ({
  title,
  description,
  organizations,
  defaultOrganization,
  handleChange,
  disabled = false,
}: {
  title?: string
  description?: string
  actionTitle: string
  organizations: {
    name: string
    id: string
  }[]
  defaultOrganization?: string
  handleChange: (organizationId: string) => void
  disabled?: boolean
}) => {
  if (organizations.length < 1) {
    return null
  }

  return (
    <FullWidthContainer>
      <form>
        <FormField
          label={title ? { text: title, htmlFor: "organization" } : undefined}
          hint={description ? { text: description } : undefined}
        >
          <Select
            id='organization'
            name='organization'
            style={{ width: "100%" }}
            onChange={(e) => {
              handleChange(e.target.value)
            }}
            defaultValue={defaultOrganization ?? organizations[0].id}
            disabled={disabled}
          >
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </Select>
        </FormField>
      </form>
    </FullWidthContainer>
  )
}
