import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"

const projectRoot = process.cwd()
const appDir = join(projectRoot, "app")

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry)
    if (statSync(fullPath).isDirectory()) {
      return collectSourceFiles(fullPath)
    }
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)
      ? [fullPath]
      : []
  })
}

// Excluding quotes from the binding clause keeps a match from spanning past a
// preceding import's specifier, which matters because this repo omits semicolons.
const dataImports = /\bimport\s+([^"']*?)from\s*"@\/data\/[^"]+"/g

// `import type` is erased at compile time, so it never reaches the client bundle.
function hasValueImportFromData(source: string): boolean {
  return [...source.matchAll(dataImports)].some(([, bindings]) => {
    if (/^type\b/.test(bindings.trim())) {
      return false
    }
    const named = bindings.match(/\{([\s\S]*)\}/)
    // A brace-only clause is type-free only if every binding is inline-typed.
    return named
      ? named[1]
          .split(",")
          .some((binding) => binding.trim() && !/^type\s/.test(binding.trim()))
      : true
  })
}

describe("client/server boundary", () => {
  // `@/data` modules read secrets through getEnvConfig(), which only resolves
  // server-side. Bundled into the browser they silently fall back to the
  // placeholder values in utils/env.ts and fetch unreachable dummy hosts.
  it("keeps @/data value imports out of client components", () => {
    const offenders = collectSourceFiles(appDir)
      .filter((file) => {
        const source = readFileSync(file, "utf8")
        return (
          /^\s*["']use client["']/.test(source) &&
          hasValueImportFromData(source)
        )
      })
      .map((file) => relative(projectRoot, file))

    expect(offenders).toEqual([])
  })
})
