"use client"

import { useCrossZoneLink } from "@citizen-portal/shared"
import { Footer, Link } from "@ogcio/design-system-react"
import { useLocale, useTranslations } from "next-intl"

/**
 * Application footer shared across all zones.
 *
 * Unified from the messages and profile zones in Phase B2. The profile
 * version was chosen as the base because the policy pages (privacy,
 * cookies, accessibility statement, terms-of-use, contact-support) all
 * live in the profile zone — `useCrossZoneLink("profile", …)` routes
 * them to the right hostname when the unified app runs behind multiple
 * nginx server_names. (The messages-zone version constructed the URLs
 * from `NEXT_PUBLIC_BASE_URL`, which was correct only because the
 * policy pages happened to live behind the same hostname there.)
 *
 * The `showContactSupport` toggle comes from the messages zone — used
 * by error pages where contacting support from a broken state is
 * ambiguous. Defaults true.
 */
export function ApplicationFooter({
  showContactSupport = true,
}: {
  showContactSupport?: boolean
}) {
  const t = useTranslations("navigation.footer")
  const locale = useLocale()
  const crossZone = useCrossZoneLink()

  const policyLink = (path: string) =>
    crossZone("profile", `/${locale}/${path}`)

  return (
    <Footer
      style={{ marginTop: "auto" }}
      utilitySlot={
        <div className='gi-flex gi-flex-row gi-gap-y-2 gi-gap-4 gi-justify-start gi-flex-wrap'>
          <Link href={policyLink("privacy-policy")} external noColor>
            {t("link.privacy")}
          </Link>
          <Link href={policyLink("cookie-policy")} external noColor>
            {t("link.cookies")}
          </Link>
          <Link href={policyLink("accessibility-statement")} external noColor>
            {t("link.accessibilityStatement")}
          </Link>
          <Link href={policyLink("terms-of-use")} external noColor>
            {t("link.termsOfUse")}
          </Link>
          {showContactSupport ? (
            <Link href={policyLink("contact-support")} external noColor>
              {t("link.contactSupport")}
            </Link>
          ) : null}
          <div className='gi-text-sm'>{t("text.trademark")}</div>
        </div>
      }
    />
  )
}
