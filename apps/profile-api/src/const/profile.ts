export const ImportStatuses = {
  PENDING: "pending",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
  UNRECOVERABLE: "unrecoverable",
  SUCCESS: "success",
} as const;

export type ImportStatus = (typeof ImportStatuses)[keyof typeof ImportStatuses];
