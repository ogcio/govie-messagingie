"use client"

import {
  Heading,
  Link,
  List,
  Paragraph,
  Stack,
} from "@ogcio/design-system-react"

export default function CookiePolicy() {
  return (
    <Stack direction='column' gap={8}>
      <Heading>Cookie Disclaimer and Policy</Heading>
      <Heading as='h2'>Disclaimer</Heading>
      <Paragraph>
        We use cookies to enhance your experience and ensure secure access to
        our messaging platform.
      </Paragraph>
      <List
        type='bullet'
        items={[
          "Essential Cookies: These are necessary for you to log in and maintain a secure session. Disabling them may prevent access to your account.",
          "Functional Cookies: We use cookies to track message status (e.g., whether a message has been opened) to improve your user experience.",
        ]}
      />
      <Paragraph>
        By continuing to use this service, you consent to our use of these
        cookies.
      </Paragraph>

      <Heading as='h2'>Cookie Policy</Heading>
      <Paragraph>Last Updated: 05/03/2025</Paragraph>
      <Heading as='h3'>1. Introduction</Heading>
      <Paragraph>
        This Cookie Policy explains how OGCIO ("we," "us," or "our") uses
        cookies to support the functionality of our secure messaging platform.
        We do not use cookies for advertising, tracking across sites, or
        marketing purposes.
      </Paragraph>
      <Paragraph>
        By using our platform, you agree to the use of cookies as described in
        this policy.
      </Paragraph>

      <Heading as='h3'>2. What Are Cookies?</Heading>
      <Paragraph>
        Cookies are small text files stored on your device that help websites
        and applications function properly. They allow us to provide secure
        access and improve the user experience.
      </Paragraph>

      <Heading as='h3'>3. Types of Cookies We Use</Heading>
      <Paragraph>
        We only use functional cookies that are essential for the platform to
        work. These include:
      </Paragraph>
      <Paragraph>a) Essential Cookies (Strictly Necessary)</Paragraph>
      <Paragraph>
        These cookies are required for the core functionality of the messaging
        platform, including:
      </Paragraph>
      <List
        type='bullet'
        items={[
          "Authentication: Maintaining your login session securely.",
          "Security: Preventing fraudulent activity and ensuring account protection.",
        ]}
      />
      <Paragraph>
        Without these cookies, the service may not function properly.
      </Paragraph>
      <Paragraph>
        b) Functional Cookies (User Experience & Message Status)
      </Paragraph>
      <Paragraph>These cookies enhance your experience by:</Paragraph>
      <List
        type='bullet'
        items={[
          "Tracking message status (e.g., whether a message has been opened).",
          "Saving user preferences (if applicable) for session continuity.",
        ]}
      />
      <Paragraph>
        These cookies do not track you across other websites or services.
      </Paragraph>

      <Heading as='h3'>4. How We Use Cookies</Heading>
      <Paragraph>
        We use cookies only for session management and to track message
        interactions within our platform. We do not use third-party tracking
        cookies or analytics cookies.
      </Paragraph>

      <Heading as='h3'>5. Managing Cookies</Heading>
      <Paragraph>
        Since our cookies are essential for security and functionality,
        disabling them may limit your ability to use our messaging service.
      </Paragraph>
      <Paragraph>
        However, you can adjust your browser settings to block or delete
        cookies. Here are guides for common browsers:
      </Paragraph>
      <List
        type='bullet'
        items={[
          <Link
            key='managing1'
            href='https://support.google.com/chrome/answer/95647'
            external
          >
            Google Chrome
          </Link>,
          <Link
            key='managing2'
            href='https://support.mozilla.org/en-US/kb/enable-and-disable-cookies-website-preferences'
            external
          >
            Mozilla Firefox
          </Link>,
          <Link
            key='managing3'
            href='https://support.apple.com/en-us/HT201265'
            external
          >
            Safari
          </Link>,
          <Link
            key='managing4'
            href='https://support.microsoft.com/en-us/help/4027947/microsoft-edge-delete-cookies'
            external
          >
            Microsoft Edge
          </Link>,
        ]}
      />

      <Heading as='h3'>6. Changes to This Policy</Heading>
      <Paragraph>
        We may update this policy from time to time. Any changes will be posted
        on this page with the updated date.
      </Paragraph>
    </Stack>
  )
}
