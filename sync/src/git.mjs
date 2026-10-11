import { run as defaultRun } from "./exec.mjs"

export class GitError extends Error {
  constructor(message, stderr = "") {
    super(message)
    this.name = "GitError"
    this.stderr = stderr
  }
}

async function must(run, args, cwd, what, timeoutMs = 60000) {
  const r = await run("git", args, { cwd, timeoutMs })
  if (r.code !== 0) throw new GitError(`${what}: ${(r.stderr || r.stdout).trim().split("\n").pop()}`, r.stderr)
  return r.stdout.trim()
}

export async function fetchStatus(repoDir, { run = defaultRun } = {}) {
  await must(run, ["fetch", "--quiet", "origin"], repoDir, "git fetch failed")
  const head = await must(run, ["rev-parse", "HEAD"], repoDir, "git rev-parse HEAD failed")
  const upstream = await must(run, ["rev-parse", "@{u}"], repoDir, "git rev-parse upstream failed")
  const behind = Number(await must(run, ["rev-list", "--count", "HEAD..@{u}"], repoDir, "git rev-list failed"))
  return { head, upstream, behind }
}

export async function pullFastForward(repoDir, { run = defaultRun } = {}) {
  await must(run, ["merge", "--ff-only", "@{u}"], repoDir, "cannot fast-forward")
  const head = await must(run, ["rev-parse", "HEAD"], repoDir, "git rev-parse HEAD failed")
  return { head }
}
