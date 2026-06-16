"use client"

import {
  Heading,
  Link,
  Paragraph,
  SectionBreak,
  Stack,
} from "@ogcio/design-system-react"
import { useTranslations } from "next-intl"

export default function ContactSupport() {
  const t = useTranslations("contactSupport")

  return (
    <Stack direction='column' gap={8}>
      <Heading>{t("title.main")}</Heading>
      <Paragraph>{t("paragraph.main")}</Paragraph>
      <SectionBreak />
      <Heading as='h2'>{t("title.departmentOfEducation")}</Heading>
      <Paragraph>
        {t.rich("paragraph.departmentOfEducation", {
          bold: (ch) => <strong>{ch}</strong>,
        })}
      </Paragraph>
      <Link
        href='https://www.forms.gov.ie/en/68401ffdb51d33001aae6382-raise-a-payroll-query-with-the'
        target='_blank'
        asButton={{ appearance: "default", size: "large", variant: "primary" }}
      >
        {t("button.departmentOfEducation")}
      </Link>
      <SectionBreak />
      <Heading as='h2'>{t("title.departmentOfSocialProtection")}</Heading>
      <Paragraph>
        {t.rich("paragraph.departmentOfSocialProtection", {
          bold: (ch) => <strong>{ch}</strong>,
        })}
      </Paragraph>
      <Link
        href='https://services.mywelfare.ie/en/other-info-pages/contact-us/'
        target='_blank'
        asButton={{ appearance: "default", size: "large", variant: "primary" }}
      >
        {t("button.departmentOfSocialProtection")}
      </Link>
    </Stack>
  )
}
