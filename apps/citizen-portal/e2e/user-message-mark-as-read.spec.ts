import { expect, test } from "@playwright/test"
import type { Message } from "@/types"
import { createAuthenticatedPage } from "./helpers/user-auth.helper"

/*
 * Locks in the AB#37866 fix: opening a message in the unified inbox must
 * fire `PUT /message-actions/<id>` AND invalidate the cached list so the
 * row's `isSeen` flips on navigate-back. Without the SWR cache bust the
 * list re-mounts with stale `isSeen: false` data and testers see the
 * message stay styled as unread, even though the seen marker did fire.
 *
 * The list, detail and message-actions endpoints are all stubbed so the
 * spec is hermetic against backend state. The list stub flips `isSeen`
 * to `true` server-side once the PUT is observed, mirroring real API
 * behaviour without coupling to it.
 */

const UNREAD_MESSAGE_ID = "e2e-mark-read-1"
const READ_MESSAGE_ID = "e2e-mark-read-2"

const buildMessage = (
  overrides: Partial<Message> & Pick<Message, "id">,
): Message => ({
  subject: "Subject",
  createdAt: "2025-04-01T10:00:00Z",
  threadName: "Department of Social Protection",
  organisationId: "org-1",
  recipientUserId: "peter.parker",
  excerpt: "Excerpt",
  isSeen: false,
  attachmentsCount: 0,
  ...overrides,
})

interface StubState {
  /** Mutable: flips to `true` once the message-actions PUT is observed. */
  unreadIsSeen: boolean
  /** Captured PUT bodies for assertion. */
  markedAsSeen: Array<{ id: string; isSeen: boolean }>
}

async function stubMessagingApis(
  page: Awaited<ReturnType<typeof createAuthenticatedPage>>,
  state: StubState,
) {
  // PUT /messaging/api/v1/message-actions/:id  → captures + flips state.
  // Registered before the messages list catch-all so a request for the
  // PUT endpoint is matched here, not by the list stub below.
  await page.route(
    "**/messaging/api/v1/message-actions/**",
    async (route, request) => {
      if (request.method() !== "PUT") {
        await route.continue()
        return
      }
      const url = new URL(request.url())
      const id = url.pathname.split("/").pop() ?? ""
      const body =
        (request.postDataJSON() as {
          messageId?: string
          isSeen?: boolean
        } | null) ?? {}
      state.markedAsSeen.push({ id, isSeen: body.isSeen === true })
      if (id === UNREAD_MESSAGE_ID && body.isSeen === true) {
        state.unreadIsSeen = true
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: null, error: null }),
      })
    },
  )

  // GET /messaging/api/v1/messages/:id  → message detail.
  await page.route("**/messaging/api/v1/messages/*", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue()
      return
    }
    const id = new URL(request.url()).pathname.split("/").pop() ?? ""
    // Skip the list endpoint — the trailing `?` query path matches this
    // glob too. Defer to the list stub below.
    if (!id || id === "messages") {
      await route.continue()
      return
    }
    const isSeen = id === UNREAD_MESSAGE_ID ? state.unreadIsSeen : true
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: buildMessage({
          id,
          subject:
            id === UNREAD_MESSAGE_ID
              ? "Open me to mark as read"
              : "Already read",
          isSeen,
          plainText: "Hello from the e2e stub.",
        }),
        error: null,
      }),
    })
  })

  // GET /messaging/api/v1/messages?...  → list.
  await page.route("**/messaging/api/v1/messages*", async (route, request) => {
    if (request.method() !== "GET") {
      await route.continue()
      return
    }
    const messages: Message[] = [
      buildMessage({
        id: UNREAD_MESSAGE_ID,
        subject: "Open me to mark as read",
        isSeen: state.unreadIsSeen,
      }),
      buildMessage({
        id: READ_MESSAGE_ID,
        subject: "Already read",
        threadName: "Revenue",
        organisationId: "org-2",
        isSeen: true,
      }),
    ]
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: messages,
        metadata: { totalCount: messages.length },
        error: null,
      }),
    })
  })
}

test.describe("Unified inbox: mark-as-read on open", () => {
  test("opens a message, fires the seen marker and the row reads as seen on navigate-back", async ({
    browser,
  }) => {
    const page = await createAuthenticatedPage(browser, "peter.parker@mail.ie")
    const state: StubState = { unreadIsSeen: false, markedAsSeen: [] }
    await stubMessagingApis(page, state)

    await page.goto("/en/messages")
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible()

    // The row's CSS Module class is hashed at build time, but the `unreadRow`
    // substring is preserved by the Next.js CSS Modules loader — making it a
    // safe regex match across local and CI builds.
    const unreadRow = page.getByRole("row", {
      name: /Open me to mark as read/i,
    })
    await expect(unreadRow).toHaveClass(/unreadRow/)

    // Wait for the PUT to be observed before navigating back, so the list
    // stub has already flipped `unreadIsSeen` and the second GET returns
    // the read state. The detail view fires markAsSeen inside a useEffect
    // gated on detail data, so the request races the user click.
    await Promise.all([
      page.waitForRequest(
        (req) =>
          req.url().includes(`/message-actions/${UNREAD_MESSAGE_ID}`) &&
          req.method() === "PUT",
      ),
      unreadRow.click(),
    ])

    // Detail view rendered.
    await expect(
      page.getByRole("heading", { name: "Open me to mark as read" }),
    ).toBeVisible()

    // The seen marker fired exactly once with the matching id + isSeen=true.
    expect(state.markedAsSeen).toEqual([
      { id: UNREAD_MESSAGE_ID, isSeen: true },
    ])

    // Click Back — the BackButton drives `window.history.back()`.
    await page.getByRole("link", { name: "Go back" }).click()

    // List view re-mounted. The cache invalidation in `useMarkMessageAsRead`
    // means SWR has either dropped the stale entry or already revalidated,
    // so the row picks up `isSeen: true` and loses the unread styling
    // without waiting on focus / reconnect heuristics.
    await expect(unreadRow).not.toHaveClass(/unreadRow/)

    // The other row was already read and must stay that way.
    await expect(
      page.getByRole("row", { name: /Already read/i }),
    ).not.toHaveClass(/unreadRow/)

    await page.close()
  })
})
