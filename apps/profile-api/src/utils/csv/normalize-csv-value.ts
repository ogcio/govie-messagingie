export const normalizeCsvValue = (
  value: string | undefined | null,
): string | undefined => {
  const outputValue = typeof value === "string" ? value.trim() : null;
  if (outputValue && outputValue.length > 0) {
    return outputValue;
  }

  return undefined;
};
