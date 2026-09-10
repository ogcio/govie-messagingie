#!/usr/bin/env node
// Validates docs/wiki/** filenames against Azure DevOps wiki page-file rules,
// so a name that would break on the wiki fails here instead of after a push.
// Rules per https://learn.microsoft.com/azure/devops/project/wiki/wiki-file-structure
import { statSync } from "node:fs"
import { dirname, join, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { listFiles, resolveSubtree } from "./paths.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT_DEFAULT = join(__dirname, "..", "..")

// ADO stores a page name with these characters percent-encoded. A raw one in
// the repo filename produces a different page identity than intended, or an
// unreachable page. Hyphen is deliberately absent: a bare "-" is how ADO
// represents a space in the title, which is the normal case.
const MUST_ENCODE = {
  ":": "%3A",
  "<": "%3C",
  ">": "%3E",
  "*": "%2A",
  "?": "%3F",
  "|": "%7C",
  '"': "%22",
}

// Fully qualified path (repo URL + folders + file) must be <= 235 chars. We
// can only measure the wiki-side path here, so this is the generous bound.
const MAX_PATH = 235
const MAX_PAGE_BYTES = 18 * 1024 * 1024

// Not pages: ADO's own sequence file and attachment store.
function isWikiControlFile(relPath) {
  return relPath.split(sep).some((s) => s === ".order" || s === ".attachments")
}

export function checkPageNames(root = REPO_ROOT_DEFAULT, subtree = "") {
  const docsWikiDir = join(root, "docs", "wiki")
  const problems = []
  let files
  try {
    files = listFiles(docsWikiDir)
  } catch {
    return problems // no docs/wiki yet — nothing to check
  }

  for (const file of files) {
    const relPath = relative(docsWikiDir, file)
    if (isWikiControlFile(relPath)) continue

    const add = (msg) => problems.push(`${relPath}: ${msg}`)

    for (const segment of relPath.split(sep)) {
      if (segment.includes(" ")) {
        add(
          `contains a space — ADO uses "-" for a space in the page title, so a literal space breaks page syntax and navigation`,
        )
      }
      for (const char of ["\\", "#"]) {
        if (segment.includes(char)) add(`contains "${char}", which ADO forbids`)
      }
      if (segment.startsWith(".") || segment.endsWith(".")) {
        add('starts or ends with ".", which ADO forbids')
      }
      // biome-ignore lint/suspicious/noControlCharactersInRegex: ADO forbids these explicitly
      if (/[\u0000-\u001f\u007f\ud800-\udfff]/.test(segment)) {
        add("contains a control or surrogate character, which ADO forbids")
      }
      for (const [char, encoded] of Object.entries(MUST_ENCODE)) {
        if (segment.includes(char)) {
          add(
            `contains a raw "${char}" — ADO expects it encoded as "${encoded}"`,
          )
        }
      }
    }

    const wikiPath = subtree ? `${subtree}/${relPath}` : relPath
    if (wikiPath.length > MAX_PATH) {
      add(
        `wiki path is ${wikiPath.length} characters, over the ${MAX_PATH} limit`,
      )
    }
    if (statSync(file).size > MAX_PAGE_BYTES) {
      add(`is larger than the 18 MB page limit`)
    }
  }

  // Case-only collisions are legal on the wiki but collapse on a
  // case-insensitive checkout (macOS, Windows), silently losing a page.
  const seen = new Map()
  for (const file of files) {
    const relPath = relative(docsWikiDir, file)
    const key = relPath.toLowerCase()
    const first = seen.get(key)
    if (first && first !== relPath) {
      problems.push(`${relPath}: differs from "${first}" only by case`)
    } else {
      seen.set(key, relPath)
    }
  }

  return problems
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rootArg = process.argv.indexOf("--root")
  const root = rootArg === -1 ? REPO_ROOT_DEFAULT : process.argv[rootArg + 1]
  let subtree = ""
  try {
    subtree = resolveSubtree(undefined)
  } catch {
    // no usable default configured; path-length check falls back to the
    // repo-relative path, which is still worth checking
  }

  const problems = checkPageNames(root, subtree)
  if (problems.length > 0) {
    console.error(
      `docs/wiki: ${problems.length} filename(s) break Azure DevOps wiki rules:\n`,
    )
    for (const problem of problems) console.error(`  ${problem}`)
    console.error(
      "\nSee https://learn.microsoft.com/azure/devops/project/wiki/wiki-file-structure",
    )
    process.exit(1)
  }
  console.log("docs/wiki: all page filenames match Azure DevOps wiki rules.")
}
