import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative, resolve, sep } from 'node:path'
import type { FlowFile } from '@overstory/core/analysis'

const SOURCE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'])
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.turbo', '.next'])

const MAX_FILE_BYTES = 24_000
const MAX_FILES = 40

export interface ReadFlowOptions {
  maxFiles?: number
  maxFileBytes?: number
}

/** Read a flow's source files from a local path (a file or a directory tree). */
export async function readFlowFiles(root: string, opts: ReadFlowOptions = {}): Promise<FlowFile[]> {
  const maxFiles = opts.maxFiles ?? MAX_FILES
  const maxFileBytes = opts.maxFileBytes ?? MAX_FILE_BYTES
  const base = await stat(root)

  if (base.isFile()) {
    return [{ path: root, content: clip(await readFile(root, 'utf8'), maxFileBytes) }]
  }

  // Containment root: every file read must resolve under here. Symlinked *files* are skipped
  // (a symlink could point outside the tree); symlinked *dirs* were never recursed. Hardening
  // for the untrusted-input case (L3 audit) — under the dogfood model the CLI runs on the
  // owner's machine, but the check is cheap and removes the foot-gun.
  const repoRoot = resolve(root)
  const out: FlowFile[] = []
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (out.length >= maxFiles) return
      if (entry.isSymbolicLink()) continue
      const full = join(dir, entry.name)
      const resolved = resolve(full)
      if (resolved !== repoRoot && !resolved.startsWith(repoRoot + sep)) continue
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full)
      } else if (entry.isFile() && SOURCE_EXT.has(extname(entry.name))) {
        out.push({ path: relative(root, full), content: clip(await readFile(full, 'utf8'), maxFileBytes) })
      }
    }
  }
  await walk(root)
  return out
}

// Clip to a BYTE budget, not a UTF-16 length (L3 audit): maxFileBytes is a prompt-size guard,
// and a multibyte-heavy file would otherwise blow past it. Slicing bytes can cut a codepoint
// mid-sequence → toString emits a trailing U+FFFD; strip it so the clip stays clean.
function clip(text: string, max: number): string {
  if (Buffer.byteLength(text, 'utf8') <= max) return text
  const sliced = Buffer.from(text, 'utf8').subarray(0, max).toString('utf8').replace(/�$/, '')
  return `${sliced}\n/* …truncated… */`
}
