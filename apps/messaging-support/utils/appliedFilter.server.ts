"server-only"
import type { ServerFilterKeyOption } from "./appliedFilter.types"

export const serverMessagingFilterKeySelectOptions: ServerFilterKeyOption[] = [
  {
    value: "status_type_email",
    type: "boolean",
    label: "Email Notification Status",
    source: { type: "column", column: "status_type_email" },
  },
  {
    value: "status_type_ie",
    type: "list",
    label: "MessagingIE Status",
    source: { type: "column", column: "status_type_ie" },
  },
  {
    value: "scheduled_at",
    type: "date",
    label: "Scheduled For Delivery",
    source: { type: "column", column: "scheduled_at" },
  },
]

export const serverProfileFilterKeySelectOptions: ServerFilterKeyOption[] = [
  {
    type: "text",
    label: "Email",
    value: "email",
    source: { type: "column", column: "email" },
  },
  {
    type: "text",
    label: "Name",
    value: "name",
    source: { type: "column", column: "name" },
  },
  {
    type: "text",
    label: "ID",
    value: "id",
    source: { type: "column", column: "p.id" },
  },
  {
    type: "text",
    label: "PPSN",
    value: "ppsn",
    source: { type: "column", column: "ppsn" },
  },
  {
    type: "date",
    label: "Date of birth",
    value: "dateOfBirth",
    source: {
      type: "keyValue",
      keyColumn: "name",
      valueColumn: "value",
      keyValue: "dateOfBirth",
    },
  },
]
