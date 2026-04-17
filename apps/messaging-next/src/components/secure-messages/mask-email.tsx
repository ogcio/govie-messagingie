export const MaskEmail: React.FC<{
  email: string
}> = ({ email }) => {
  const maskEmail = (email: string) => {
    if (!email) return ""

    const [localPart, domain] = email.split("@")

    if (!localPart || !domain) return email

    if (localPart.length <= 2) return email

    const firstChar = localPart[0]
    const lastChar = localPart[localPart.length - 1]
    const maskedLocal = `${firstChar}${"•".repeat(localPart.length - 2)}${lastChar}`

    return `${maskedLocal}@${domain}`
  }

  return <span>{maskEmail(email)}</span>
}
