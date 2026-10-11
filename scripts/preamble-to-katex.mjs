// Reads the balanced {...} group starting at src[i] === "{"; returns [content, indexAfter] or null.
function group(src, i) {
  if (src[i] !== "{") return null
  let depth = 0
  for (let j = i; j < src.length; j++) {
    if (src[j] === "\\") { j++; continue }
    if (src[j] === "{") depth++
    else if (src[j] === "}" && --depth === 0) return [src.slice(i + 1, j), j + 1]
  }
  return null
}

export function parsePreamble(src) {
  const macros = {}
  const re = /\\(?:re)?newcommand\*?\s*\{(\\[A-Za-z]+)\}\s*(?:\[\d\])?\s*(?=\{)|\\def\s*(\\[A-Za-z]+)\s*(?:#\d)*\s*(?=\{)|\\DeclareMathOperator\*?\s*\{(\\[A-Za-z]+)\}\s*(?=\{)/g
  for (const m of src.matchAll(re)) {
    const body = group(src, m.index + m[0].length)
    if (!body) continue
    if (m[3]) macros[m[3]] = `\\operatorname{${body[0]}}`
    else macros[m[1] ?? m[2]] = body[0]
  }
  return macros
}
