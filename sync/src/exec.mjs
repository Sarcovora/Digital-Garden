import { execFile } from "node:child_process"

// Never rejects on a non-zero exit (callers read `code`); rejects only if the command cannot be spawned.
export function run(cmd, args = [], { cwd, env, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      cmd,
      args,
      { cwd, env: env ? { ...process.env, ...env } : process.env, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err && err.code === "ENOENT") return reject(err)
        resolve({ code: err ? (typeof err.code === "number" ? err.code : 1) : 0, stdout: String(stdout), stderr: String(stderr) })
      },
    )
    child.on("error", reject)
  })
}
