# messaging-next

A Next.js citizen-facing messaging application that uses the **Secure API Gateway** (`@ogcio/sag-client`) for authentication and API access.

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│  messaging-next  (Next.js, client-side auth)                   │
│                                                                │
│  SagClientProvider  ─── useAuth()  ─── useGatewayFetch()       │
│       │                    │                  │                 │
│       │              claims, user,       SWR-based data        │
│       │              onboarding check    fetching               │
└───────┼────────────────────┼──────────────────┼────────────────┘
        │                    │                  │
        ▼                    ▼                  ▼
┌────────────────────────────────────────────────────────────────┐
│  Secure API Gateway  (Fastify :3333)                           │
│  /auth/sign-in, /auth/status, /auth/invalidate-session         │
│  /messaging/*  (proxy to messaging API)                        │
└────────────────────────────────────────────────────────────────┘
```

- **No server-side auth** — authentication is entirely client-side via the Secure API Gateway
- **No middleware** — role checks and onboarding happen in the React component tree
- **Citizen-only** — sign-in defaults to MyGovID connector (`social:mygovid`)

## Authentication

Authentication is handled by `@ogcio/sag-client/react` in the `ClientShell` component (`src/components/client-shell.tsx`):

1. **`SagClientProvider`** wraps the app with gateway URL and app name
2. **`useAuth()`** provides `user`, `claims`, `signIn`, `signOut`, `invalidateSession`
3. **Sign-in** uses `{ connector: CONNECTOR_MYGOVID }` to go directly to MyGovID (no Logto sign-in screen)

## Onboarding Flow

Onboarding is handled by the `useOnboardingGuard` hook from `@ogcio/sag-client/react`. The `ClientShell` component uses it with a single call:

```tsx
// publicServantRoles defaults to DEFAULT_PUBLIC_SERVANT_ROLES
// (["Organisation Admin", "Organisation Member"])
const { resolved } = useOnboardingGuard({
  profileUrl: env.NEXT_PUBLIC_PROFILE_URL,
  appBaseUrl: env.NEXT_PUBLIC_BASE_URL,
  connector: CONNECTOR_MYGOVID,
})

if (!resolved) return <Loading />
```

The hook performs the following checks automatically:

| Step | Check | Action |
|------|-------|--------|
| 1 | **Citizen onboarded** | If `isCitizenOnboarded(claims.roles)` is true, proceed (`resolved = true`) |
| 2 | **Not a citizen** | If the user holds public-servant organisation roles, proceed (citizen-only app) |
| 3 | **Wrong sign-in method** | If `signinMethod` is not in `ALLOWED_SIGNIN_METHODS`, redirect to the profile service's `/wrong-login-method-error` page |
| 4 | **Citizen not onboarded** | Call `invalidateSession()` then redirect to the profile service's `/onboarding` page |

A `sessionStorage`-based debounce (30 seconds) prevents infinite redirect loops when the onboarding redirect chain brings the user back still not-onboarded.

The full redirect chain for an unonboarded citizen:

```
messaging-next (useOnboardingGuard detects not-onboarded)
  → POST /auth/invalidate-session (clear server session)
  → redirect to profile-service/onboarding?source=<gateway-sign-in-url>
      → (user completes onboarding, gains "Onboarded citizen" role)
      → GET gateway/auth/sign-in?app=messaging&redirectUrl=<app-url>&connector=social:mygovid
          → Logto OIDC flow (fresh claims)
          → gateway/auth/callback
          → redirect to messaging-next (original page, now with updated roles)
```

> **Important:** Children (including `useGatewayFetch` hooks) are not rendered until `resolved` is `true`, preventing API requests from racing with session invalidation.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_BASE_URL` | No | `http://localhost:3000` | App base URL (used in onboarding redirect URLs) |
| `NEXT_PUBLIC_SAG_URL` | Yes | - | Secure API Gateway URL |
| `NEXT_PUBLIC_SAG_APP_NAME` | Yes | - | Application name registered in the gateway |
| `NEXT_PUBLIC_PROFILE_URL` | No | `http://localhost:3001` | Profile service URL (onboarding and wrong-login-method redirects) |
| `NEXT_PUBLIC_FORMS_SERVICE_URL` | No | `http://localhost:3003` | Forms service URL (error reporting redirects) |
| `NEXT_PUBLIC_ERROR_FORM_ID` | No | `""` | Error form ID appended to the forms service URL |

### Example `.env.local`

```env
NEXT_PUBLIC_SAG_URL=http://localhost:3333
NEXT_PUBLIC_SAG_APP_NAME=messaging
NEXT_PUBLIC_PROFILE_URL=http://localhost:3001
```

## Secure Messages (Account Linking)

The secure-messages page at `/[locale]/secure-messages?id=<messageId>` handles the account-linking flow. A user arrives here (typically via an email link) when a message was sent to a profile that isn't yet linked to their Logto identity.

### How the flow works

```
1. Fetch message with user token
   ├── 200 OK → user owns message → redirect to /messages?id=<messageId>
   └── 401/403/404 → user does NOT own message → fall through to M2M

2. Fetch message with M2M token → get recipientUserId

3. Fetch recipient profile with M2M → get linked profile
   └── if profile.id !== profile.primary_user_id → already linked → redirect to /messages

4. Fetch current user's profile with user token

5. Show account-linking UI
   └── User confirms → PATCH profile (set primary_user_id) → redirect to /messages?id=<messageId>
```

### Testing locally with real APIs

You need the following services running:

- **Secure API Gateway** (`:3333`)
- **Messaging API** (`:8002`) with a PostgreSQL database
- **Profile API** (`:8003`) with a PostgreSQL database
- **Logto** (`:3301`) with MyGovID connector configured

#### Scenario 1: Account linking prompt (match found, no primary account)

This is the main flow. The user sees the "Is this you?" screen with a Confirm button.

**Prerequisites:**

1. Two Logto users: **User A** (the logged-in user) and **User B** (the message recipient, created during onboarding but not yet linked).

2. A profile for **User B** in the `profiles` table where `primary_user_id` equals the profile's own `id` (meaning it has not been linked yet):

   ```sql
   -- Check the profile for User B (the recipient)
   SELECT id, email, primary_user_id FROM profiles WHERE id = '<user-b-profile-id>';

   -- Ensure primary_user_id == id (not linked)
   UPDATE profiles
   SET primary_user_id = id
   WHERE id = '<user-b-profile-id>';
   ```

3. A profile for **User A** (the logged-in user) must also exist:

   ```sql
   SELECT id, email, primary_user_id FROM profiles WHERE id = '<user-a-logto-sub>';
   ```

4. A message in the `messages` table addressed to **User B**:

   ```sql
   -- Find or create a message for User B
   SELECT id, user_id, subject, security_level FROM messages WHERE user_id = '<user-b-profile-id>';

   -- If none exists, insert one
   INSERT INTO messages (organisation_id, user_id, lang, security_level, subject, plain_text)
   VALUES (
     '<org-id>',
     '<user-b-profile-id>',
     'en',
     'confidential',
     'Please verify your identity',
     'This is a secure message requiring identity verification.'
   )
   RETURNING id;
   ```

5. Log in as **User A** and navigate to:

   ```
   http://localhost:3002/en/secure-messages?id=<message-uuid>
   ```

   The page should show the account-linking UI with both emails and a Confirm/Report button.

**What happens under the hood:**

- User-token fetch for the message returns 404 (User A is not `user_id` on the message)
- M2M fetch returns the message with `recipientUserId = <user-b-profile-id>`
- M2M profile fetch returns User B's profile where `id === primary_user_id` (eligible for linking)
- User-token profile fetch returns User A's profile
- The UI is displayed; clicking Confirm PATCHes User B's profile to set `primary_user_id = <user-a-logto-sub>`

#### Scenario 2: User already owns the message (is the primary account)

The user is immediately redirected to the message detail view.

**Prerequisites:**

1. The `user_id` column on the message matches the logged-in user's profile `id`, OR the logged-in user's profile is already set as the `primary_user_id` on the recipient's profile.

   ```sql
   -- Option A: message is directly addressed to the logged-in user
   SELECT id FROM messages WHERE user_id = '<logged-in-user-profile-id>';

   -- Option B: the recipient's profile already has primary_user_id = logged-in user
   UPDATE profiles
   SET primary_user_id = '<logged-in-user-logto-sub>'
   WHERE id = '<recipient-profile-id>';
   ```

2. Navigate to `/en/secure-messages?id=<message-uuid>`. The page redirects to `/en/messages?id=<message-uuid>`.

#### Scenario 3: Profile already linked to a different user

The user is redirected to `/messages` (no specific message shown).

**Prerequisites:**

1. The recipient profile's `primary_user_id` is set to a **different** user (not the logged-in one):

   ```sql
   UPDATE profiles
   SET primary_user_id = '<some-other-user-id>'
   WHERE id = '<recipient-profile-id>';
   ```

2. Navigate to `/en/secure-messages?id=<message-uuid>`. The page redirects to `/en/messages`.

### Key database columns

| Table | Column | Application alias | Purpose |
|-------|--------|--------------------|---------|
| `messages` | `id` | `id` | Message UUID (used in the `?id=` query param) |
| `messages` | `user_id` | `recipientUserId` | Profile ID of the message recipient |
| `messages` | `security_level` | `security` | `"confidential"` or `"public"` |
| `profiles` | `id` | `id` | Profile ID (Logto nano ID) |
| `profiles` | `primary_user_id` | `primaryUserId` | The Logto user linked to this profile. When `== id`, the profile is unlinked |
| `profiles` | `email` | `email` | Shown in the account-linking UI |

### URL format

The secure-messages page uses a query parameter for the message ID:

```
/en/secure-messages?id=<message-uuid>
```

In production, nginx redirects the old path-based format to the query parameter format:

```
/en/secure-messages/<message-uuid>  →  302  →  /en/secure-messages?id=<message-uuid>
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@ogcio/sag-client` | Authentication, role detection, onboarding helpers, gateway fetch |
| `next` | React framework |
| `next-intl` | Internationalization (English/Irish) |
| `swr` | Client-side data fetching (via `useGatewayFetch`) |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx                    # Root HTML shell
│   ├── page.tsx                      # Locale redirect
│   └── [locale]/
│       ├── layout.tsx                # i18n + ClientShell wrapper
│       ├── messages/page.tsx         # Messages page (SWR shallow routing)
│       └── secure-messages/page.tsx # Account-linking page (?id=<messageId>)
├── components/
│   ├── client-shell.tsx              # Auth provider + onboarding checks
│   ├── button/
│   │   ├── signin-button.tsx
│   │   ├── signout-button.tsx
│   │   └── back-button.tsx
│   ├── messages/
│   │   ├── messages.tsx              # Message list/detail (useGatewayFetch)
│   │   └── messages-client.tsx
│   └── secure-messages/
│       ├── secure-message-page.tsx   # Account-linking flow orchestrator
│       ├── account-linking-view.tsx  # Linking confirmation UI
│       ├── confirm-button.tsx        # PATCH profile via useGatewayMutation
│       ├── report-button.tsx         # External error form redirect
│       └── service-error.tsx         # Error state with report option
├── env/
│   ├── env.client.ts                 # Client env vars (validated with zod)
│   └── env.server.ts                 # Server env vars
├── i18n/                             # Internationalization config
└── hooks/
    └── use-locale-preference.ts      # Browser locale detection
```

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Copy environment template
cp .env.sample .env.local

# Start the dev server (PORT=3002)
pnpm --filter messaging-next dev   # or: pnpm dev:messaging-next (from root)
```

The app runs on [http://localhost:3002](http://localhost:3002) and expects the Secure API Gateway at `http://localhost:3333`.

## Testing

```bash
pnpm --filter messaging-next test          # vitest (jsdom) + coverage
pnpm --filter messaging-next test:local    # watch mode
pnpm --filter messaging-next test:browser  # vitest browser (playwright)
pnpm --filter messaging-next test:e2e:local # playwright
```
