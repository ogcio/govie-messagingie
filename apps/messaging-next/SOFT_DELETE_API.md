# Soft-Delete Network Calls — messaging-next ↔ messaging-api

Authoritative reference for every HTTP request the Unified Inbox fires while
soft-deleting one or more messages, and the contract each call must honour on
the backend side. Scope is the citizen-facing flow introduced with the RFC —
the "unified-inbox" feature flag. No public-servant / admin flow.

All requests leave the browser against the **Secure API Gateway** (SAG) at
`<gatewayUrl>/messaging/api/v1/...`; SAG proxies them into **messaging-api**
(prefix `/api/v1/messages` and `/api/v1/message-actions`). The gateway injects
the citizen's bearer token, sets `X-Application`, and forwards the cookies that
carry the session. None of this is visible to the React code.

---

## 1. Endpoints introduced / touched by soft delete

| Purpose                     | Method   | Gateway path (from the browser)              | messaging-api route (OpenAPI canonical) | Triggered from                                     |
| --------------------------- | -------- | --------------------------------------------- | ---------------------------------------- | -------------------------------------------------- |
| Soft-delete 1..N messages   | `DELETE` | `/messaging/api/v1/messages`                  | `DELETE /api/v1/messages/`               | Unified inbox bulk toolbar, detail-view `Delete`   |
| Re-read the inbox list      | `GET`    | `/messaging/api/v1/messages?limit=&offset=…` | `GET /api/v1/messages/` (op: `ListMessages`) | SWR revalidation fired from `onSettled`            |
| Mark-as-read on detail open | `PUT`    | `/messaging/api/v1/message-actions/{id}`      | `PUT /api/v1/message-actions/{messageId}` | Detail view, once per mount, independent of delete |

> Trailing slash note: The OpenAPI document (`apps/messaging-api/openapi-definition.yml`)
> registers every messages path with a trailing slash — `/api/v1/messages/` and
> `/api/v1/messages/{messageId}`. The client sends the path without one;
> Fastify accepts both because the service runs with `ignoreTrailingSlash`
> enabled by convention. If you regenerate a strict client from the spec you'll
> get the trailing-slash variant — both resolve to the same handler.

There is **no `/restore`, no `/trash`, no undo** endpoint — soft-delete is a
one-way transition from the citizen's perspective. The OpenAPI spec **does**
expose two read-side levers for soft-deleted rows that messaging-next simply
doesn't use today:

- `GET /api/v1/messages/` supports `deletedAfterDateTime=<ISO-8601>` (list
  only, timestamp-bounded window into the trash).
- `GET /api/v1/messages/{messageId}` supports `deleted=true|false|0|1`
  (detail only, lets you fetch a tombstoned message directly).

Both live on the existing read routes; neither is wired from the UI.

---

## 2. The delete request

### 2.1 Client call site

```19:30:apps/messaging-next/src/components/messages/use-delete-messages.ts
 * Wraps the gateway `DELETE /messaging/api/v1/messages` endpoint (see
 * messaging-api deleteMessages service). Soft-delete is backend-side; the hook
 * exposes the last result so the list view can render the info/danger alert
 * banners from the design.
 */
export function useDeleteMessages(options: UseDeleteMessagesOptions = {}) {
  const { onSettled } = options

  const { trigger, isLoading } = useGatewayMutation<
    { data: { ids: string[] } },
    { ids: string[] }
  >("/messaging/api/v1/messages", { method: "DELETE" })
```

`useGatewayMutation` is a thin wrapper around `SagClient.mutate` which, in
turn, is a plain `fetch` with `credentials: "include"` and an `X-Application`
header. There is no retry, no throttle, no optimistic cache update.

### 2.2 Wire-level request

```
DELETE  {gatewayUrl}/messaging/api/v1/messages
Content-Type: application/json
X-Application: messaging
Cookie:  <sag session>

{ "ids": ["<uuid>", "<uuid>", …] }
```

- `ids` is de-duplicated client-side before the call (`Array.from(new Set(ids))`)
- 1 ≤ `ids.length` ≤ 100 (validated by Typebox on the server)
- Each id must be a UUID (the UI only ever passes ids it got back from `GET`)
- Method is always `DELETE` even for a single-message delete from the detail
  view; the batch endpoint serves both flows.

### 2.3 Wire-level response (success)

```
HTTP/1.1 200 OK
Content-Type: application/json

{ "data": { "ids": ["<uuid>", …] } }
```

The server echoes back the ids it accepted. The client only inspects whether
the promise resolved; it does not read the ids from the response body (it
keeps the input set instead, which is the same list minus duplicates).

### 2.4 Error responses

| Status | Shape                                                            | When                                                                             | UI outcome                               |
| ------ | ---------------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| 400    | `{ code, detail, name, statusCode, requestId, validation? }`     | Body fails validation (empty `ids`, non-UUID, >100 ids)                          | Danger toast "…could not be deleted"     |
| 401    | SAG-internal; `SagFetchError`                                    | Session expired — `SagClient` redirects to sign-in automatically                 | Redirect, no toast                       |
| 403    | `{ detail: "Not allowed to delete one or more messages" }`       | Recipient user is not the caller or any of their linked profiles                 | Danger toast                             |
| 403    | `{ detail: "Public servant users cannot delete messages" }`      | Caller has an `organizationId` on their token                                    | Danger toast (should never happen in UI) |
| 404    | `{ detail: "One or more messages not found" }`                   | Any id missing **or already soft-deleted** (the backend groups these together)   | Danger toast                             |
| 5xx    | `{ detail: "An unexpected error occurred while deleting…" }`     | DB failure / rollback after `executeSoftDelete` transaction                      | Danger toast (8s)                        |

The hook normalises all of these to a single `{ ok: false, ids }` result:

```39:53:apps/messaging-next/src/components/messages/use-delete-messages.ts
      try {
        await trigger({ ids: unique })
        const result: DeleteMessagesResult = { ok: true, ids: unique }
        setLastResult(result)
        return result
      } catch {
        const result: DeleteMessagesResult = { ok: false, ids: unique }
        setLastResult(result)
        return result
      } finally {
        onSettled?.()
      }
```

There is **no per-id partial success**. If a single id in the batch is wrong
the whole request returns 4xx and nothing is soft-deleted (the update runs
inside a single `BEGIN…COMMIT`).

---

## 3. Server-side effect of a successful delete

No other HTTP traffic is generated *by the API* — but the handler can make
one internal side-call:

```484:491:apps/messaging-api/src/services/messages/message-service.ts
    await client.query(
      `
      UPDATE messages
      SET deleted_at = now(), updated_at = now()
      WHERE id = ANY($1)
    `,
      [uniqueMessageIds],
    );
```

- A single `UPDATE messages SET deleted_at = now(), updated_at = now() WHERE id = ANY($1)`
  inside a `BEGIN/COMMIT` transaction.
- No row is physically removed.
- No outbound webhook, no analytics `track.event`, no event-log row. Audit
  trail for delete is intentionally the `updated_at` / `deleted_at` pair.

### Linked-profile cross-check (profile-api fan-out)

When the caller tries to delete messages addressed to a **different**
`recipientUserId` than their own, messaging-api calls profile-api to confirm
the two profiles are linked:

```450:463:apps/messaging-api/src/services/messages/message-service.ts
  let validUserIds = [loggedInUser.userId];
  if (hasOtherRecipients) {
    const linkedProfiles = await getLinkedProfiles({
      userData: {
        organizationId: undefined,
        userId: loggedInUser.userId,
        accessToken: loggedInUser.accessToken,
      },
      logger,
    });
    validUserIds = Array.from(
      new Set([loggedInUser.userId, ...linkedProfiles]),
    );
  }
```

`getLinkedProfiles` → `ProfilePersonalSdkWrapper.getLinkedProfileIds(userId)`
→ `GET /profile/api/v1/user-profiles/:id` on profile-api (citizen-bearer
token). This is **lazy**: skipped entirely when every selected row belongs
to the caller themselves (the default and most common path on the inbox).

---

## 4. Client-side flows

### 4.1 Bulk delete from the list view

```
User clicks row checkboxes
   → selection.selectedIds grows
User clicks BulkActionToolbar "Delete"
   → openDeleteConfirmation(Array.from(selectedIds))
   → <DeleteConfirmationModal /> opens (no network)
User clicks "Delete" in the modal
   → confirmDelete()
   → deleteIds(ids)         ── DELETE /messaging/api/v1/messages
   → onSettled()             ── calls refresh() from useGatewayFetch
      → GET /messaging/api/v1/messages?…  (SWR mutate)
   → if ok: selection.clear(), exit select mode
   → <DeleteResultToast /> dispatches success or danger toast
```

The SWR `refresh()` is the **only cache-invalidation mechanism**. We do not
call `mutate` globally, do not remove rows optimistically, do not rewrite the
SWR cache for the list. The toast appears before the re-fetch resolves, so
the user briefly sees the stale row "greyed" only if their network is slow —
a known, accepted trade-off.

### 4.2 Single delete from the detail view

```
User opens /messages?id=<uuid>
   → GET /messaging/api/v1/messages/<uuid>     (SWR key A)
   → on first render, PUT /messaging/api/v1/message-actions/<uuid>
                      body: { messageId, isSeen: true }    (fire-and-forget)
User clicks "Delete" → <DeleteConfirmationModal />
User confirms
   → deleteIds([id])  ── DELETE /messaging/api/v1/messages
   → sessionStorage.setItem("messaging-next.delete-flash", JSON.stringify(result))
   → router.push(listPath)    (strips ?id=, back to inbox)
   → list mount reads flash → dispatches DeleteResultToast → clears flash
```

The flash round-trip lives entirely in `sessionStorage`; no additional HTTP
call. The inbox list then issues its own `GET /messages` as part of the usual
mount-time SWR fetch, which naturally excludes the freshly soft-deleted row
(backend defaults to `deleted_at IS NULL`).

### 4.3 Mobile select-mode

Network behaviour is identical to 4.1 — the mobile header re-uses the same
`useDeleteMessages` hook via the same `onBulkDelete` callback. Only the UX
affordance (dark select header + `bulk-delete-button-mobile`) differs.

---

## 5. Cache & revalidation map

| SWR key                                                              | Invalidated by delete? | How                                                              |
| -------------------------------------------------------------------- | ---------------------- | ---------------------------------------------------------------- |
| `/messaging/api/v1/messages?limit=&offset=&isSeen=…&search=…`        | **Yes**                | `refresh()` (aka `mutate`) from `useGatewayFetch`, via `onSettled` |
| `/messaging/api/v1/messages/{id}` (detail)                           | No (route unmounts)    | Detail view navigates away; next visit is a fresh fetch          |
| `/upload/api/v1/metadata/{id}` (attachments)                         | No                     | Independent domain; attachments outlive the row                  |

> Because the list key includes `limit/offset/isSeen/search`, the refresh only
> invalidates **the current page the user is looking at**. Other paginations
> remain stale until navigated to. This is intentional — the old inbox had the
> same behaviour; no regression.

The list response shape the client unpacks is the standard pagination
envelope from `formatAPIResponse`:

```json
{
  "data": [ /* ReadMessage[] */ ],
  "metadata": {
    "totalCount": 123,
    "links": { "self": { "href": "…" }, "first": {…}, "last": {…}, "next": {…}, "pages": {…} }
  }
}
```

messaging-next reads **only** `metadata.totalCount` (for the pager) and
`data`; the HATEOAS `links` block is ignored.

---

## 6. Request lifecycle diagram

```
  Browser                     SAG                    messaging-api                profile-api               Postgres
     │                         │                           │                           │                       │
     │  DELETE /messaging/…    │                           │                           │                       │
     │────────────────────────▶│  DELETE /api/v1/messages  │                           │                       │
     │                         │──────────────────────────▶│ SELECT id, deleted_at,    │                       │
     │                         │                           │        user_id …          │                       │
     │                         │                           │──────────────────────────────────────────────────▶│
     │                         │                           │◀──────────────────────────────────────────────────│
     │                         │                           │   (if not own): GET /profile/api/v1/user-profiles │
     │                         │                           │──────────────────────────▶│                       │
     │                         │                           │◀──────────────────────────│                       │
     │                         │                           │ BEGIN; UPDATE deleted_at; │                       │
     │                         │                           │ COMMIT;                   │                       │
     │                         │                           │──────────────────────────────────────────────────▶│
     │                         │                           │◀──────────────────────────────────────────────────│
     │                         │◀──────────────────────────│ 200 { data: { ids } }     │                       │
     │◀────────────────────────│                           │                           │                       │
     │                         │                           │                           │                       │
     │  GET /messaging/…?…     │                           │                           │                       │
     │────────────────────────▶│  GET /api/v1/messages     │                           │                       │
     │                         │──────────────────────────▶│ SELECT … WHERE deleted_at │                       │
     │                         │                           │            IS NULL …      │                       │
     │                         │                           │──────────────────────────────────────────────────▶│
     │                         │                           │◀──────────────────────────────────────────────────│
     │                         │◀──────────────────────────│ 200 { data, metadata }    │                       │
     │◀────────────────────────│                           │                           │                       │
```

---

## 7. Open-API contract (server)

Typebox source of truth:

```310:331:apps/messaging-api/src/types/messages.ts
const DeleteMessagesIdsSchema = Type.Object({
  ids: Type.Array(Type.String({ format: "uuid" }), {
    description: "List of message ids to delete",
    minItems: 1,
    maxItems: 100,
  }),
});

export type DeleteMessagesIds = Static<typeof DeleteMessagesIdsSchema>;

export const DeleteMessagesReqSchema = {
  description: "Deletes the message with the given message id",
  tags: MESSAGES_TAGS,
  response: {
    200: Type.Object({
      data: DeleteMessagesIdsSchema,
    }),
    "5xx": HttpError,
    "4xx": HttpError,
  },
  body: DeleteMessagesIdsSchema,
};
```

Permissions are `MessageSelf.Write` **AND** `OnboardedCitizen` — i.e. the
route is unreachable for public-servant tokens. Public-servant tokens that
do reach it get an extra 403 check (`organizationId` present on the token).

---

## 8. Observability checklist

- Frontend: nothing bespoke. Toast success/failure are the only user-facing
  signals; network panel shows the `DELETE` + a follow-up `GET`.
- Backend: structured `logger.warn`s for the two "not found" cases
  (missing id, already-deleted id) and the forbidden-recipient case. No
  dedicated metric counter, no analytics event. If you need dashboards for
  soft-delete volume, add a counter next to `messagesCreatedCounter` in
  `src/utils/metrics.ts` — out of scope for the current RFC.

## 9. What is **not** implemented today

- Restore / undelete (no endpoint, no UI button).
- Permanent delete (DB row lives forever; retention policy is ops-owned).
- Per-id partial-success response (batch is all-or-nothing).
- Optimistic UI removal (rows flicker out only after the list refetches).
- Cross-page selection (select-all only touches the visible page; the
  batch-size cap of 100 on the API is never exercised from the UI).

---

## 10. Appendix — verified against `apps/messaging-api/openapi-definition.yml`

All three endpoints documented above were cross-checked line-by-line against
the service's OpenAPI definition.

### `DELETE /api/v1/messages/`

- **Path**: lines 14–660 host the `/api/v1/messages/` path object; the
  `delete` operation is registered at **line 518**. No `operationId` is set
  (the other verbs — `ListMessages`, `CreateMessage`, `GetMessage` —
  do have one; the delete route was added without an explicit id).
- **Request body** (lines 523–537): `application/json`, required, with
  `{ ids: string[] }`, `minItems: 1`, `maxItems: 100`, items
  `type: string, format: uuid` — matches `DeleteMessagesIdsSchema` in
  `apps/messaging-api/src/types/messages.ts:310`.
- **200 response** (lines 538–560): `{ data: { ids: string[] (uuid, 1..100) } }`
  — matches the service handler's `reply.status(200).send({ data: { ids } })`.
- **4xx/5xx** (lines 561–660): generic `HttpError` envelope
  (`code, detail, requestId, name, statusCode, validation?, validationContext?`).
  Matches `@fastify/sensible` output for the `httpErrors.*` the handler throws.

### `GET /api/v1/messages/`

- **Operation**: `ListMessages` (line 16).
- **Query parameters** (lines 21–97) — every parameter and whether
  messaging-next uses it:

  | OpenAPI param           | Used by messaging-next inbox? | Notes                                                      |
  | ----------------------- | ------------------------------ | ---------------------------------------------------------- |
  | `status`                | No                             | Enum `delivered`. Irrelevant for citizen view.             |
  | `isSeen`                | **Yes**                        | `"true"` / `"false"` — wired to the `status=read/unread` filter. |
  | `search`                | **Yes**                        | From the search bar.                                       |
  | `deletedAfterDateTime`  | No                             | Would surface trash after a timestamp; not wired.          |
  | `tagId` / `untagged`    | No                             | No tag UX in messaging-next.                               |
  | `recipientUserId`       | No                             | Backend derives it from the token.                         |
  | `organisationId`        | No                             | Public-servant only.                                       |
  | `offset`                | **Yes**                        | Computed as `(page - 1) * pageSize`.                       |
  | `limit`                 | **Yes**                        | Equal to `pageSize` (default `6`).                         |

- **Response** (lines 98–200): `{ data: Message[], metadata: { links, totalCount } }`.
  Client reads `data` + `metadata.totalCount`; `links` is ignored.

### `GET /api/v1/messages/{messageId}`

- **Operation**: `GetMessage` (line 912).
- **Query**: `deleted` enum `"true"/"false"/"0"/"1"` (lines 915–925). Not
  used by messaging-next — the detail view never passes it, so it always
  returns the live row and 404s a tombstoned one. This is the complement to
  `deletedAfterDateTime` on the list route.
- **200 response** (line 933+): `{ data: Message }` with the full body
  (`subject, createdAt, threadName, organisationId, recipientUserId,`
  `excerpt, plainText, richText, isSeen, security, attachments, externalId`).
  Frontend type (`src/types/index.ts`) is structurally compatible.

### `PUT /api/v1/message-actions/{messageId}`

- **Operation**: no `operationId` in the spec (line 4444). Defined at
  `apps/messaging-api/src/types/message-actions.ts:16` as
  `PutMessageActionReqSchema`.
- **Path param**: `messageId: string (uuid)`.
- **Request body** (lines 4447–4461): `{ messageId: uuid, isSeen: boolean }`,
  both required. The handler additionally enforces
  `request.params.messageId === request.body.messageId` (400 on mismatch).
- **200 response** (lines 4469–4471): **schema-less** — the Typebox schema
  is `Type.Null()`, so the body is empty on success. `useGatewayMutation`
  tolerates this (it `.then(r => r.data)` on `response.json()`; Fastify
  sends `{}` for `Type.Null()`, and the hook ignores the return value).
- **4xx/5xx**: standard `HttpError` envelope.

### Items that differ between spec and implementation (none material)

| Observation                                               | Impact                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| OpenAPI paths use trailing `/`; client omits it.          | None — both match the same Fastify route.                                                  |
| `DELETE` has no `operationId`.                            | Cosmetic; codegen names it from method+path. Easy to add later.                            |
| `PUT /message-actions/{messageId}` 200 has no schema.     | Matches `Type.Null()`; intentional — the hook doesn't read the body.                       |
| `limit` regex is `^([1-9]|100)|undefined$`.                | The inbox sends single-digit limits (default 6) so it falls inside the first alternative. |

No drift that warrants a UI change. If the spec is regenerated from the
handler schemas the same paths and bodies will come back.
