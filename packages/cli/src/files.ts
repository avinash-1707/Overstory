import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
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

  const out: FlowFile[] = []
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (out.length >= maxFiles) return
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) await walk(full)
      } else if (SOURCE_EXT.has(extname(entry.name))) {
        out.push({ path: relative(root, full), content: clip(await readFile(full, 'utf8'), maxFileBytes) })
      }
    }
  }
  await walk(root)
  return out
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}\n/* …truncated… */` : text
}
