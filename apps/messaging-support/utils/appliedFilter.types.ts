import type {
  dateOptions,
  MessageEventStatusKey,
  MessageStatusEventKey,
} from "./appliedFilter"

export type MessageEventType =
  (typeof MessageStatusEventKey)[keyof typeof MessageStatusEventKey]
export type MessageEventStatus =
  (typeof MessageEventStatusKey)[keyof typeof MessageEventStatusKey]

export type BooleanMeta = {
  type: "boolean"
  failed: boolean
  successful: boolean
}

export type DateMeta = {
  type: "date"
  dateOption: "from" | "to" | "between"
  from?: string
  to?: string
}

export type ListMeta = {
  type: "list"
  selectedValue: MessageEventType
  failed: boolean
  successful: boolean
}

export type TextMeta = {
  type: "text"
  text: string
}

export type FilterMeta = BooleanMeta | DateMeta | ListMeta | TextMeta

export type AppliedFilter<Meta extends FilterMeta = FilterMeta> = {
  id: string // unique for React rendering
  key: string // the core filter key: scheduled_at, is_seen, etc.
  keylabel: string // user-friendly label for display
  value: string // display value
  urlValue: string // url query param derived from meta
  // col: string         // specific column
  meta: Meta // strongly typed meta per filter type
}

export type DateOption = (typeof dateOptions)[number]

export type ClientFilterKeyOption = {
  value: string
  type: "boolean" | "date" | "list" | "text"
  label: string
}

type ColumnSource = { type: "column"; column: string }
type KeyValueSource = {
  type: "keyValue"
  keyColumn: string
  valueColumn: string
  keyValue: string
}

export type ServerFilterKeyOption = {
  value: string
  type: "boolean" | "list" | "date" | "text"
  label: string
  source: ColumnSource | KeyValueSource
  query?: (idx: number) => string
}
