import type {
  AppliedFilter,
  BooleanMeta,
  DateMeta,
  DateOption,
  FilterMeta,
  ListMeta,
  MessageEventType,
  TextMeta,
} from "./appliedFilter.types"

export const dateOptions = ["between", "from", "to"] as const

type BuildFilterParams<T extends FilterMeta = FilterMeta> = {
  key: string
  keylabel: string
  meta: T
}

function isDateOption(s: unknown): s is DateOption {
  const t = s as DateOption
  return t === "between" || t === "from" || t === "to"
}

function buildAppliedBooleanFilter(
  params: BuildFilterParams<BooleanMeta>,
): AppliedFilter<BooleanMeta> {
  const { key, keylabel, meta } = params
  const value = `${
    meta.failed || meta.successful
      ? ` (${[meta.successful && "successful", meta.failed && "failed"].filter(Boolean).join(", ")})`
      : "None"
  }`
  return {
    id: crypto.randomUUID(),
    key,
    keylabel,
    urlValue: encodeBooleanParam(meta),
    value,
    meta,
  }
}

function buildAppliedListFilter(
  params: BuildFilterParams<ListMeta>,
): AppliedFilter<ListMeta> {
  const { key, keylabel, meta } = params
  const { failed, selectedValue, successful } = meta

  const display = `${getMessageEventTypeLabel(selectedValue as MessageEventType)}${
    failed || successful
      ? ` (${[successful && "successful", failed && "failed"].filter(Boolean).join(", ")})`
      : " None"
  }`
  return {
    id: crypto.randomUUID(),
    key,
    keylabel,
    value: display,
    urlValue: encodeListParam(meta),
    meta,
  }
}

function buildAppliedDateFilter(
  params: BuildFilterParams<DateMeta>,
): AppliedFilter<DateMeta> {
  const { key, keylabel, meta } = params

  const { from, to } = meta
  // if (!from && !to) { return "" }

  let value = ""
  if (from && to) {
    value = `between ${from} and ${to}`
  } else if (from) {
    value = `from ${from}`
  } else if (to) {
    value = `to ${to}`
  }

  return {
    id: crypto.randomUUID(),
    key,
    keylabel,
    value,
    urlValue: encodeDateParam(meta),
    meta,
  }
}

function buildAppliedTextFilter(
  params: BuildFilterParams<TextMeta>,
): AppliedFilter<TextMeta> {
  const { key, keylabel, meta } = params
  return {
    id: crypto.randomUUID(),
    key,
    keylabel,
    value: meta.text,
    urlValue: encodeTextParam(meta),
    meta,
  }
}

export function encodeListParam(meta: ListMeta): string {
  const val: string[] = [meta.selectedValue]
  if (meta.failed) {
    val.push("failed")
  }
  if (meta.successful) {
    val.push("successful")
  }
  return val.join(",")
}

export function decodeListParam(value: string): ListMeta {
  const parts = value.split(",")
  const valuePart = parts.at(0)
  if (!valuePart) {
    throw new Error("missing required value variable in list query")
  }

  const meta: ListMeta = {
    type: "list",
    selectedValue: valuePart as MessageEventType,
    failed: false,
    successful: false,
  }
  for (const p of parts) {
    if (p === "successful") {
      meta.successful = true
    }
    if (p === "failed") {
      meta.failed = true
    }
  }
  return meta
}

export function encodeDateParam(meta: DateMeta): string {
  const { from, to } = meta
  let value: string | undefined
  if (from && to) {
    value = `between,${from},${to}`
  } else if (from) {
    value = `from,${from}`
  } else if (to) {
    value = `to,${to}`
  } else {
    value = ""
  }

  return value
}

export function decodeDateParam(value: string): DateMeta {
  const split = value.split(",")
  // Expected formats are:
  // between,2023-01-01,2023-01-31
  // from,2023-01-01
  // to,2023-01-31
  const dateOption = split.at(0)
  if (!isDateOption(dateOption)) {
    throw new Error("invalid first param of date value string")
  }

  const meta: DateMeta = {
    type: "date",
    dateOption,
  }

  if (split.length === 3 && dateOption === "between") {
    meta.from = split[1]
    meta.to = split[2]
  } else if (split.length === 2 && dateOption === "from") {
    meta.from = split[1]
  } else if (split.length === 2 && dateOption === "to") {
    meta.to = split[1]
  }

  return meta
}

export function encodeBooleanParam(meta: BooleanMeta): string {
  const val: string[] = []
  if (meta.failed) {
    val.push("failed")
  }
  if (meta.successful) {
    val.push("successful")
  }
  return val.join(",")
}

export function decodeBooleanParam(value: string): BooleanMeta {
  const split = value.split(",")
  return {
    type: "boolean",
    failed: split.some((s) => s === "failed"),
    successful: split.some((s) => s === "successful"),
  }
}

export function encodeTextParam(meta: TextMeta): string {
  return meta.text
}

export function decodeTextParam(value: string): TextMeta {
  return { type: "text", text: value }
}

export function buildAppliedFilter(params: {
  key: string
  keylabel: string
  meta: FilterMeta
}) {
  const { key, keylabel, meta } = params
  switch (meta.type) {
    case "boolean":
      return buildAppliedBooleanFilter({ key, keylabel, meta })
    case "date":
      return buildAppliedDateFilter({ key, keylabel, meta })
    case "list":
      return buildAppliedListFilter({ key, keylabel, meta })
    case "text":
      return buildAppliedTextFilter({ key, keylabel, meta })
  }
}

export const MessageStatusEventKey = {
  MESSAGE_CREATE: "message_create",
  MESSAGE_JOB_CREATE: "message_job_create",
  MESSAGE_SCHEDULE: "message_schedule",
  TEMPLATE_MESSAGE_CREATE: "template_message_create",
  MESSAGE_DELIVERY: "message_delivery",
  EMAIL_DELIVERY: "email_delivery",
  MESSAGE_OPTION_SEEN: "message_option_seen",
  MESSAGE_OPTION_UNSEEN: "message_option_unseen",
} as const

export const MessageEventStatusKey = {
  SUCCESSFUL: "successful",
  FAILED: "failed",
} as const

export function getMessageEventTypeLabel(key: MessageEventType) {
  switch (key) {
    case "email_delivery":
      return "Email Notification"
    case "message_delivery":
      return "Delivered"
    case "message_option_seen":
      return "Seen"
    case "message_option_unseen":
      return "Unseen"
    case "message_schedule":
      return "Scheduled for delivery"
    default:
      return "Internal message process"
  }
}

export function isBooleanMeta(t: FilterMeta | null): t is BooleanMeta {
  return t?.type === "boolean"
}

export function isListMeta(t: FilterMeta | null): t is ListMeta {
  return t?.type === "list"
}

export function isDateMeta(t: FilterMeta | null): t is DateMeta {
  return t?.type === "date"
}

export function isTextMeta(t: FilterMeta | null): t is TextMeta {
  return t?.type === "text"
}
