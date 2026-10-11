import { cp, mkdir, writeFile } from "node:fs/promises"
import { spawn } from "node:child_process"
import path from "node:path"
import { drawingMd } from "./drawing.mjs"

const PNG_1X1 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="

export async function makeFixtureVault(destDir) {
  await cp(path.resolve("tests/fixture-vault"), destDir, { recursive: true })
  await mkdir(path.join(destDir, "99 - Meta", "Files"), { recursive: true })
  await writeFile(path.join(destDir, "99 - Meta", "Files", "pic.png"), Buffer.from(PNG_1X1, "base64"))
  await mkdir(path.join(destDir, "05 - Excalidraw"), { recursive: true })
  await writeFile(path.join(destDir, "05 - Excalidraw", "Sample.excalidraw.md"), drawingMd("fixture"))
  await writeFile(path.join(destDir, "05 - Excalidraw", "Plain.excalidraw.md"), drawingMd("plain", { compressed: false }))
  return destDir
}

export function buildFixture({ vaultDir, outDir, env = {} }) {
  return new Promise((resolve) => {
    const child = spawn("npx", ["quartz", "build", "-d", vaultDir, "-o", outDir], {
      env: { ...process.env, ...env },
    })
    let output = ""
    child.stdout.on("data", (d) => (output += d))
    child.stderr.on("data", (d) => (output += d))
    const timer = setTimeout(() => child.kill("SIGKILL"), 120000)
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, output })
    })
  })
}
