import { Tag } from "@ogcio/design-system-react"

const STATUS_TAG_MAP: Record<string, "warning" | "success" | "error" | "info"> =
  {
    pending: "warning",
    processing: "info",
    success: "success",
    error: "error",
    completed: "success",
    failed: "error",
  }

export function StatusTag({ status }: { status: string | null | undefined }) {
  if (!status) return null
  const type = STATUS_TAG_MAP[status] ?? "info"
  return <Tag type={type} text={status} />
}
