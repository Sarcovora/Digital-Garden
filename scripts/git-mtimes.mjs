import { execFile } from "node:child_process"
import { promisify } from "node:util"
const exec = promisify(execFile)

// Latest commit time (unix seconds) per vault-relative path. `git log` is newest-first,
// so the first time a path appears is its latest change.
export async function gitMtimes(repoDir) {
  let stdout
  try {
    ;({ stdout } = await exec("git", ["log", "--name-only", "--no-renames", "-z", "--pretty=format:%x01%ct"], {
      cwd: repoDir,
      maxBuffer: 256 * 1024 * 1024,
    }))
  } catch {
    return {}
  }
  const result = {}
  for (const block of stdout.split("\x01").slice(1)) {
    const nl = block.indexOf("\n")
    const t = Number(block.slice(0, nl).trim())
    for (const name of block.slice(nl + 1).split("\0")) {
      const n = name.replace(/^\n+/, "")
      if (n && !(n in result)) result[n] = t
    }
  }
  return result
}
