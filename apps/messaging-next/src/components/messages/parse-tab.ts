export type Tab = "all" | "unread"

export function parseTab(value: string | null | undefined): Tab {
  return value === "all" ? "all" : "unread"
}
