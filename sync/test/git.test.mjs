import test from "node:test"
import assert from "node:assert/strict"
import { rm } from "node:fs/promises"
import { fetchStatus, pullFastForward, GitError } from "../src/git.mjs"
import { makeRepos, git } from "./helpers.mjs"

test("fetchStatus reports 0 behind, then 1 after the remote moves", async () => {
  const r = await makeRepos()
  assert.equal((await fetchStatus(r.vault)).behind, 0)
  await r.pushCommit("two")
  const s = await fetchStatus(r.vault)
  assert.equal(s.behind, 1)
  assert.notEqual(s.head, s.upstream)
})
test("pullFastForward advances HEAD to the upstream", async () => {
  const r = await makeRepos()
  await r.pushCommit("two")
  await fetchStatus(r.vault)
  const { head } = await pullFastForward(r.vault)
  assert.equal(head, git(r.vault, "rev-parse", "HEAD").trim())
  assert.equal((await fetchStatus(r.vault)).behind, 0)
})
test("a rewritten remote history cannot fast-forward and leaves HEAD alone", async () => {
  const r = await makeRepos()
  const before = git(r.vault, "rev-parse", "HEAD").trim()
  await r.rewriteHistory()
  await fetchStatus(r.vault)
  await assert.rejects(() => pullFastForward(r.vault), GitError)
  assert.equal(git(r.vault, "rev-parse", "HEAD").trim(), before)
})
test("an unreachable remote throws GitError from fetchStatus", async () => {
  const r = await makeRepos()
  await rm(r.remote, { recursive: true, force: true })
  await assert.rejects(() => fetchStatus(r.vault), GitError)
})
