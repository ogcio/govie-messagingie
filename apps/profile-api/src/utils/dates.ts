export function getCurrentUTCDate(): string {
  return new Date().toISOString();
}

export const isISODate = (value: string): boolean => {
  // ISO 8601 regex pattern
  const isoPattern =
    /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[-+]\d{2}:?\d{2})?)?$/;

  if (!isoPattern.test(value)) {
    return false;
  }

  const date = new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime());
};

export const toIsoDateTime = (value: string): string => {
  const date = new Date(value);
  return date.toISOString();
};

const toIsoDateFromSlashDate = (value: string): string | undefined => {
  const slashDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = slashDatePattern.exec(value.trim());

  if (!match) {
    return undefined;
  }

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = Number(match[3]);

  const candidateMonthDayPairs: Array<{ month: number; day: number }> = [];

  if (first > 12 && second <= 12) {
    candidateMonthDayPairs.push({ month: second, day: first });
  } else if (second > 12 && first <= 12) {
    candidateMonthDayPairs.push({ month: first, day: second });
  } else if (first <= 12 && second <= 12) {
    candidateMonthDayPairs.push({ month: second, day: first });
    candidateMonthDayPairs.push({ month: first, day: second });
  }

  for (const { month, day } of candidateMonthDayPairs) {
    const parsedDate = new Date(Date.UTC(year, month - 1, day));
    const isValidDate =
      parsedDate.getUTCFullYear() === year &&
      parsedDate.getUTCMonth() === month - 1 &&
      parsedDate.getUTCDate() === day;

    if (isValidDate) {
      return parsedDate.toISOString().split("T")[0];
    }
  }

  return undefined;
};

export const toIsoDate = (value: string): string => {
  const slashDate = toIsoDateFromSlashDate(value);
  if (slashDate) {
    return slashDate;
  }

  const date = new Date(value);
  return date.toISOString().split("T")[0];
};
