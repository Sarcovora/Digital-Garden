// Copies self-hosted KaTeX CSS/fonts and the Literata / Source Sans 3 variable fonts into quartz/static.
import { cp, mkdir, copyFile } from "node:fs/promises"
import path from "node:path"

const nm = (p) => path.join("node_modules", p)
const out = (p) => path.join("quartz", "static", p)

await mkdir(out("katex/fonts"), { recursive: true })
await mkdir(out("fonts"), { recursive: true })
await copyFile(nm("katex/dist/katex.min.css"), out("katex/katex.min.css"))
await cp(nm("katex/dist/fonts"), out("katex/fonts"), {
  recursive: true,
  filter: (src) => !src.endsWith(".ttf") && !(src.endsWith(".woff") && !src.endsWith(".woff2")),
})
for (const [pkg, file] of [
  ["literata", "literata-latin-standard-normal.woff2"],
  ["literata", "literata-latin-standard-italic.woff2"],
  ["source-sans-3", "source-sans-3-latin-wght-normal.woff2"],
  ["source-sans-3", "source-sans-3-latin-wght-italic.woff2"],
]) await copyFile(nm(`@fontsource-variable/${pkg}/files/${file}`), out(`fonts/${file}`))
for (const f of ["Virgil.ttf", "Excalifont.ttf"]) await copyFile(nm(`@excalidraw/utils/dist/prod/assets/${f}`), out(`fonts/${f}`))
await mkdir(out("mermaid"), { recursive: true })
await copyFile(nm("mermaid/dist/mermaid.esm.min.mjs"), out("mermaid/mermaid.esm.min.mjs"))
await cp(nm("mermaid/dist/chunks/mermaid.esm.min"), out("mermaid/chunks/mermaid.esm.min"), { recursive: true })
console.log("assets copied")
