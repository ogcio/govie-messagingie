import { SendAtMode } from "../domain/statuses.js";
import type { ResolvedSendAt } from "../domain/types.js";

type ResolveSendAtInput = {
  sendAt: string | undefined;
  now: Date;
};

const ISO_8601_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/u;

export function isIso8601Timestamp(value: string): boolean {
  if (!ISO_8601_PATTERN.test(value)) {
    return false;
  }

  return !Number.isNaN(new Date(value).valueOf());
}

export function resolveSendAt({
  sendAt,
  now,
}: ResolveSendAtInput): ResolvedSendAt {
  if (sendAt == null) {
    return {
      sendAtMode: SendAtMode.Immediate,
      fingerprintValue: SendAtMode.Immediate,
      scheduleAt: now,
      sendAtValue: null,
    };
  }

  if (!isIso8601Timestamp(sendAt)) {
    throw new Error(`SEND_AT must be a valid ISO-8601 timestamp: ${sendAt}`);
  }

  const scheduledDate = new Date(sendAt);

  if (Number.isNaN(scheduledDate.valueOf())) {
    throw new Error(`SEND_AT must be a valid ISO-8601 timestamp: ${sendAt}`);
  }

  const scheduleAt = scheduledDate.toISOString();

  return {
    sendAtMode: SendAtMode.Scheduled,
    fingerprintValue: `scheduled:${scheduleAt}`,
    scheduleAt: scheduledDate,
    sendAtValue: scheduledDate,
  };
}
