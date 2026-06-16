export const interpolationReducer = (
  interpolations: Record<string, string> | undefined,
) =>
  function reducer(acc: string, key: string) {
    return acc.replaceAll(`{{${key}}}`, interpolations?.[key] || "")
  }
