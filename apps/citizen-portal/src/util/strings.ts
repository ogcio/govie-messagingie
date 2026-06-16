/**
 * Returns a masked placeholder for sensitive string values (e.g. PPSN
 * before reveal). Length is fixed per known type so the rendered field
 * width doesn't leak the real value length.
 */
export function stringToAsterisk(type: string): string {
  switch (type) {
    case "ppsn":
      return "*******"
    default:
      return "****"
  }
}
