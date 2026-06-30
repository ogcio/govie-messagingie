/**
 * User-created message folder. Mirrors the shape returned by
 * `GET /messaging/api/v1/tags` so the Folders epic can swap mock
 * fixtures for real API data without changing UI components.
 */
export interface Folder {
  id: string
  label: string
}

/**
 * A destination the user can move a message to — either a custom folder
 * or the untagged inbox (`id: null`).
 */
export interface MoveDestination {
  id: string | null
  label: string
}
