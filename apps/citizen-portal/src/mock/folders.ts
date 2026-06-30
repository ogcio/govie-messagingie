/**
 * Mock folder fixtures for the Move-to-folder UX until the Folders
 * epic wires `GET /messaging/api/v1/tags`. Labels mirror the Figma
 * sidebar (EHIC, Payslips). Replace `getMockFolders()` with a gateway
 * fetch when tags land — keep the `Folder` type in `types/folder.ts`.
 */
import type { Folder, MoveDestination } from "@/types/folder"

const MOCK_FOLDERS: Folder[] = [
  { id: "mock-folder-ehic", label: "EHIC" },
  { id: "mock-folder-payslips", label: "Payslips" },
]

export function getMockFolders(): Folder[] {
  return MOCK_FOLDERS
}

/**
 * Builds the list of valid move destinations for a message.
 *
 * - In inbox (`currentFolderId === null`): all user folders; Inbox hidden.
 * - In a folder: all other folders plus Inbox as `id: null`.
 */
export function getMoveDestinations(
  currentFolderId: string | null,
  inboxLabel: string,
): MoveDestination[] {
  const folders = getMockFolders()
  const destinations: MoveDestination[] = []

  if (currentFolderId !== null) {
    destinations.push({ id: null, label: inboxLabel })
  }

  for (const folder of folders) {
    if (folder.id !== currentFolderId) {
      destinations.push(folder)
    }
  }

  return destinations
}
