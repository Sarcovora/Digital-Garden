import LZString from "lz-string"

export function drawingMd(label = "hello", { compressed = true } = {}) {
  const base = {
    angle: 0, strokeColor: "#1e1e1e", backgroundColor: "transparent", fillStyle: "solid",
    strokeWidth: 2, strokeStyle: "solid", roughness: 0, opacity: 100, groupIds: [], frameId: null,
    roundness: null, seed: 1, version: 1, versionNonce: 1, isDeleted: false, boundElements: null,
    updated: 1, link: null, locked: false,
  }
  const elements = [
    { ...base, id: "r1", type: "rectangle", x: 0, y: 0, width: 120, height: 60 },
    { ...base, id: "t1", type: "text", x: 10, y: 10, width: 60, height: 25, text: label, fontSize: 20,
      fontFamily: 1, textAlign: "left", verticalAlign: "top", baseline: 18, containerId: null,
      originalText: label, lineHeight: 1.25, autoResize: true },
  ]
  const json = JSON.stringify({ type: "excalidraw", version: 2, elements, appState: { viewBackgroundColor: "#ffffff" }, files: {} })
  const body = compressed
    ? `\`\`\`compressed-json\n${LZString.compressToBase64(json)}\n\`\`\``
    : `\`\`\`json\n${json}\n\`\`\``
  return `---\nexcalidraw-plugin: parsed\n---\n# Text Elements\n${label} ^t1\n\n%%\n# Drawing\n${body}\n%%`
}
