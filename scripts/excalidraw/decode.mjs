import LZString from "lz-string"

const COMPRESSED = /```compressed-json\s*([\s\S]*?)```/
const PLAIN = /#+\s*Drawing\s*```json\s*([\s\S]*?)```/

export function extractDrawing(md) {
  try {
    const c = md.match(COMPRESSED)
    if (c) {
      const json = LZString.decompressFromBase64(c[1].replace(/\s+/g, ""))
      return json ? JSON.parse(json) : null
    }
    const p = md.match(PLAIN)
    return p ? JSON.parse(p[1]) : null
  } catch {
    return null
  }
}
