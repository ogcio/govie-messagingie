export function stringToAsterisk(type: string): string {
  switch (type) {
    case "ppsn":
      return "*******"
    default:
      return "****"
  }
}

export function trimSlash(input: string) {
  let i = input.length
  while (i-- && input.charAt(i) === "/") {}
  return input.substring(0, i + 1)
}
