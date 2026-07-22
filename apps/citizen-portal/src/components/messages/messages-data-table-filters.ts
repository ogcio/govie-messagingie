export type MessageFilterStatus = "unread" | "read"

export type MessageFilterState = {
  selectedStatuses: MessageFilterStatus[]
}

export const emptyMessageFilters: MessageFilterState = {
  selectedStatuses: [],
}

export function messageFiltersFromStatusParam(
  status: string | null,
): MessageFilterState {
  if (status === "unread") {
    return { selectedStatuses: ["unread"] }
  }
  if (status === "read") {
    return { selectedStatuses: ["read"] }
  }
  return emptyMessageFilters
}

export function statusParamFromMessageFilters(
  filters: MessageFilterState,
): string | null {
  const { selectedStatuses } = filters
  if (selectedStatuses.length !== 1) {
    return null
  }
  return selectedStatuses[0] ?? null
}

export function activeMessageFilterLabels(args: {
  filters: MessageFilterState
  labels: Record<MessageFilterStatus, string>
}): { id: string; label: string }[] {
  return args.filters.selectedStatuses.map((status) => ({
    id: status,
    label: args.labels[status],
  }))
}
