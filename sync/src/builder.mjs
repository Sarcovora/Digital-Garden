import { mkdir, readdir, rename, rm, symlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { run as defaultRun } from "./exec.mjs"
import { gitMtimes } from "../../scripts/git-mtimes.mjs"

const stamp = (ms) => new Date(ms).toISOString().replace(/[-:T]/g, "").slice(0, 14)

export async function build({ vaultDir, dataDir, buildCmd, verify, run = defaultRun, now = Date.now, keep = 2 }) {
  const buildId = stamp(now())
  const buildsDir = path.join(dataDir, "builds")
  const out = path.join(buildsDir, buildId)
  await mkdir(buildsDir, { recursive: true })
  try {
    await rm(out, { recursive: true, force: true })
    const mtimesFile = path.join(dataDir, "mtimes.json")
    await writeFile(mtimesFile, JSON.stringify(await gitMtimes(vaultDir)))
    const r = await run(buildCmd.cmd, [...buildCmd.args, "-d", vaultDir, "-o", out], {
      cwd: buildCmd.cwd,
      timeoutMs: 15 * 60 * 1000,
      env: {
        GARDEN_BUILD_ID: buildId,
        GARDEN_VAULT: vaultDir,
        GARDEN_MTIMES: mtimesFile,
        EXCALIDRAW_CACHE_DIR: path.join(dataDir, "cache", "excalidraw"),
      },
    })
    if (r.code !== 0) throw new Error(`build failed: ${(r.stderr || r.stdout).trim().split("\n").slice(-3).join(" | ")}`)
    const v = await verify({ outDir: out, vaultDir })
    if (!v.ok) throw new Error(`verification failed: ${v.errors.slice(0, 5).join("; ")}`)
    // Atomic swap: build the new symlink beside `current`, then rename over it.
    const tmp = path.join(dataDir, "current.tmp")
    await rm(tmp, { force: true })
    await symlink(path.join("builds", buildId), tmp)
    await rename(tmp, path.join(dataDir, "current"))
    const all = (await readdir(buildsDir)).sort()
    for (const old of all.slice(0, Math.max(0, all.length - keep))) await rm(path.join(buildsDir, old), { recursive: true, force: true })
    return { buildId }
  } catch (err) {
    await rm(out, { recursive: true, force: true })
    throw err
  }
}
