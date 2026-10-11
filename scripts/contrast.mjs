const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}

export function contrast(a, b) {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// Reads --garden-* hex colors for a theme; dark inherits anything it does not override.
export function readTokens(css, theme) {
  const base = css.match(/:root\s*\{([^}]*)\}/)[1]
  const dark = css.match(/:root\[saved-theme="dark"\]\s*\{([^}]*)\}/)[1]
  const out = {}
  for (const src of theme === "dark" ? [base, dark] : [base])
    for (const m of src.matchAll(/--garden-([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2]
  return out
}
