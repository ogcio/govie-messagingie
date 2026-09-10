"use client"

import { FormField, Select, SelectItem } from "@ogcio/design-system-react"
import { FullWidthContainer } from "@/components/profile-admin/layout/containers"

interface OrganizationSelectorProps {
  title?: string
  description?: string
  organizations: { id: string; name: string }[]
  defaultOrganization?: string
  onChange: (organizationId: string) => void
  disabled?: boolean
}

export function OrganizationSelector({
  title,
  description,
  organizations,
  defaultOrganization,
  onChange,
  disabled = false,
}: OrganizationSelectorProps) {
  if (organizations.length < 1) return null

  return (
    <FullWidthContainer>
      <form>
        <FormField
          hint={description ? { text: description } : undefined}
          label={title ? { text: title, htmlFor: "organization" } : undefined}
        >
          <Select
            id='organization'
            name='organization'
            style={{ width: "100%" }}
            onChange={(e) => onChange(e.target.value)}
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
