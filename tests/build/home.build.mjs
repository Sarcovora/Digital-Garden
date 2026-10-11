import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile, mkdir, utimes } from "node:fs/promises"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import path from "node:path"
import { makeFixtureVault, buildFixture } from "../helpers/fixture.mjs"
import { gitMtimes } from "../../scripts/git-mtimes.mjs"

test("build emits the home page and a small garden index with git dates", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "garden-"))
  const vault = await makeFixtureVault(path.join(root, "vault"))
  // make the vault a git repo so modified dates come from commits, not file mtimes
  const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t", GIT_COMMITTER_DATE: "2026-03-01T00:00:00Z", GIT_AUTHOR_DATE: "2026-03-01T00:00:00Z" }
  execFileSync("git", ["init", "-q"], { cwd: vault, env }); execFileSync("git", ["add", "-A"], { cwd: vault, env })
  execFileSync("git", ["-c", "commit.gpgsign=false", "commit", "-qm", "x"], { cwd: vault, env })
  const mtimes = path.join(root, "mtimes.json")
  await writeFile(mtimes, JSON.stringify(await gitMtimes(vault)))
  const out = path.join(root, "out")
  const { code, output } = await buildFixture({ vaultDir: vault, outDir: out, env: { GARDEN_MTIMES: mtimes } })
  assert.equal(code, 0, output.slice(-800))
  const index = JSON.parse(await readFile(path.join(out, "static", "garden-index.json"), "utf8"))
  const alpha = index.find((e) => e.title === "Alpha Note")
  assert.ok(alpha); assert.equal(alpha.folder, "")
  assert.equal(index.find((e) => e.title === "1 Cor. 12").folder, "Bible")
  assert.equal(alpha.modified, Date.parse("2026-03-01T00:00:00Z") / 1000)
  assert.equal(Object.keys(alpha).sort().join(), "folder,modified,path,slug,title")
  assert.ok(index.every((e) => !e.slug.includes(".obsidian")))
  const home = await readFile(path.join(out, "index.html"), "utf8")
  assert.match(home, /data-garden-home/)
  assert.match(home, /data-area="Bible"/)
  assert.match(home, /class="[^"]*\bsearch\b/)
})
