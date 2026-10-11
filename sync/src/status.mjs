import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import path from "node:path"

const INITIAL = { state: "idle", behind: 0, lastSyncedAt: null, commit: null, buildId: null, error: null, checkError: null }

// Status is kept in memory and persisted to <dataDir>/status.json so it survives a restart.
// A restart never resumes a "building" state: nothing is building anymore.
export async function createStatusStore(dataDir) {
  const file = path.join(dataDir, "status.json")
  let status = { ...INITIAL }
  try {
    status = { ...INITIAL, ...JSON.parse(await readFile(file, "utf8")), state: "idle" }
  } catch {}
  return {
    get: () => ({ ...status }),
    async set(patch) {
      status = { ...status, ...patch }
      await mkdir(dataDir, { recursive: true })
      await writeFile(file + ".tmp", JSON.stringify(status))
      await rename(file + ".tmp", file)
      return { ...status }
    },
  }
}
