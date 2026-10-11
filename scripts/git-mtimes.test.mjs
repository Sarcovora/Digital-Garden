import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, writeFile, mkdir } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { gitMtimes } from "./git-mtimes.mjs"

const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" }
const git = (cwd, ...a) => execFileSync("git", a, { cwd, env })

test("maps each file to its latest commit time, including names with spaces", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gm-"))
  git(dir, "init", "-q")
  await mkdir(path.join(dir, "sub dir"))
  await writeFile(path.join(dir, "a.md"), "1")
  await writeFile(path.join(dir, "sub dir", "b c.md"), "1")
  git(dir, "add", "-A")
  env.GIT_COMMITTER_DATE = "2026-01-01T00:00:00Z"; env.GIT_AUTHOR_DATE = "2026-01-01T00:00:00Z"
  git(dir, "-c", "commit.gpgsign=false", "commit", "-qm", "one")
  await writeFile(path.join(dir, "a.md"), "2")
  git(dir, "add", "-A")
  env.GIT_COMMITTER_DATE = "2026-02-01T00:00:00Z"; env.GIT_AUTHOR_DATE = "2026-02-01T00:00:00Z"
  git(dir, "-c", "commit.gpgsign=false", "commit", "-qm", "two")
  const m = await gitMtimes(dir)
  assert.deepEqual(Object.keys(m).sort(), ["a.md", "sub dir/b c.md"])
  assert.equal(m["a.md"], Date.parse("2026-02-01T00:00:00Z") / 1000)
  assert.equal(m["sub dir/b c.md"], Date.parse("2026-01-01T00:00:00Z") / 1000)
})
test("a directory that is not a repo yields an empty map", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "gm-"))
  assert.deepEqual(await gitMtimes(dir), {})
})
