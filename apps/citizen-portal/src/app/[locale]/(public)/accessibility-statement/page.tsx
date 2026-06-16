"use client"

import {
  Heading,
  Link,
  List,
  Paragraph,
  Stack,
} from "@ogcio/design-system-react"

export default function AccessibilityStatement() {
  return (
    <Stack direction='column' gap={8}>
      <Heading>Statement of commitment</Heading>
      <Paragraph>
        We are committed to making this website accessible in accordance with
        S.I. 358/2020.
      </Paragraph>
      <Paragraph>
        We are committed to achieving AA standard under WCAG 2.1 guidelines.
      </Paragraph>
      <Paragraph>
        This accessibility statement applies to this site only - not other
        government sites or subdomains.
      </Paragraph>

      <Heading as='h2'>Compliance status</Heading>
      <Paragraph>
        This website is currently mostly compliant with WCAG 2.1 AA guidelines.
      </Paragraph>

      <Heading as='h2'>Non-accessible content</Heading>
      <Paragraph>
        PDFs: Many documents are published as PDFs - which are less accessible
        than HTML pages for people using assistive technologies. Some of the
        issues with PDFs include:
      </Paragraph>
      <List
        type='bullet'
        items={[
          "The fact that they are not bookmarked ( WCAG guideline 2.4.5 )",
          "Tables in PDFs are not defined ( WCAG guideline 1.3.1 )",
        ]}
      />
      <Paragraph>
        This content is not an exhaustive list of non-accessible content.
      </Paragraph>

      <Heading as='h2'>Exempted content</Heading>
      <Paragraph>
        PDF documents that were published before 23 September 2018 are exempt
        from these guidelines except where it is related to a service that a
        member of the public has to use.
      </Paragraph>
      <Paragraph>
        Videos or audio published before 23 September 2020 are exempt from these
        guidelines.
      </Paragraph>

      <Heading as='h2'>How we test the services.gov.ie site</Heading>
      <Paragraph>
        We use the WCAG level AA guidelines to test how accessible gov.ie is. We
        used the Website Accessibility Conformance Evaluation Methodology
        (WCAG-EM) approach to assess the site.
      </Paragraph>
      <Paragraph>
        We have completed accessibility audits and have carried out user testing
        on the site. We will continue to do this - particularly once we can
        carry out in-person testing again.
      </Paragraph>
      <Paragraph>
        We regularly engage with the National Disability Authority who are the
        monitoring body for accessibility of public sector websites in Ireland
        are subject to annual audits every year.
      </Paragraph>

      <Heading as='h2'>
        How we are going to improve accessibility on this website
      </Heading>
      <List
        type='bullet'
        items={[
          "We are going to make photo-descriptions mandatory on the website and carry out regular spot-checks on photos across all departments on a quarterly basis",
          "We will continue to work with units to make sure they are publishing HTML pages instead of less accessible formats like PDF",
          "We will continue to insist that users use plain English to describe services members of the public will rely on feedback and contact information",
        ]}
      />
      <Paragraph>
        Each department is responsible for its own content on this website.
      </Paragraph>

      <Paragraph>
        If you have any complaints about the accessibility of content used on a
        department's site - then you can contact the{" "}
        <Link href='https://gov.ie/en/govie-team/collections/disability-access-officers-across-government/'>
          relevant Disability Access Officer
        </Link>{" "}
        in each department.
      </Paragraph>

      <Heading as='h2'>Escalation of a complaint</Heading>
      <Paragraph>
        If you are not happy with the department's response then you can{" "}
        <Link href='https://www.ombudsman.ie/disability-act/make-a-complaint/'>
          make a complaint to the Ombudsman under the Disability Act
        </Link>
        .
      </Paragraph>
      <Paragraph>This statement was last updated on 31 March 2025.</Paragraph>
    </Stack>
  )
}
