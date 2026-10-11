import { execFileSync } from "node:child_process"
import { mkdtemp, writeFile, readFile, lstat, readlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" }
export const git = (cwd, ...a) => execFileSync("git", a, { cwd, env }).toString()

export async function makeRepos() {
  const root = await mkdtemp(path.join(tmpdir(), "sync-"))
  const remote = path.join(root, "remote.git")
  const seed = path.join(root, "seed")
  const vault = path.join(root, "vault")
  git(root, "init", "-q", "--bare", "-b", "main", remote)
  git(root, "clone", "-q", remote, seed)
  await writeFile(path.join(seed, "a.md"), "one")
  git(seed, "add", "-A"); git(seed, "-c", "commit.gpgsign=false", "commit", "-qm", "one"); git(seed, "push", "-q", "origin", "HEAD:main")
  git(root, "clone", "-q", remote, vault)
  const pushCommit = async (text) => {
    await writeFile(path.join(seed, "a.md"), text)
    git(seed, "add", "-A"); git(seed, "-c", "commit.gpgsign=false", "commit", "-qm", text); git(seed, "push", "-q", "origin", "HEAD:main")
  }
  const rewriteHistory = async () => {
    await writeFile(path.join(seed, "a.md"), "rewritten")
    git(seed, "checkout", "-q", "--orphan", "fresh"); git(seed, "add", "-A")
    git(seed, "-c", "commit.gpgsign=false", "commit", "-qm", "rewritten"); git(seed, "push", "-qf", "origin", "HEAD:main")
  }
  return { root, remote, seed, vault, pushCommit, rewriteHistory }
}

// A stand-in for `quartz build -d <vault> -o <out>`: writes index.html containing the vault's a.md.
export async function fakeBuildScript(root) {
  const p = path.join(root, "fake-build.mjs")
  await writeFile(p, `
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
const a = process.argv; const d = a[a.indexOf("-d")+1]; const o = a[a.indexOf("-o")+1]
if (process.env.FAKE_BUILD_FAIL) { console.error("boom"); process.exit(2) }
await new Promise((r) => setTimeout(r, Number(process.env.FAKE_BUILD_MS ?? 0)))
mkdirSync(o, { recursive: true })
writeFileSync(o + "/index.html", "<p>" + readFileSync(d + "/a.md", "utf8") + "</p>")
`)
  return p
}

export const currentHtml = async (dataDir) => readFile(path.join(dataDir, "current", "index.html"), "utf8")
export const currentTarget = async (dataDir) => readlink(path.join(dataDir, "current"))
export const exists = (p) => lstat(p).then(() => true, () => false)
