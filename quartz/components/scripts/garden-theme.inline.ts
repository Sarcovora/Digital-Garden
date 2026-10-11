// Runs before first paint: resolves the theme preference (system | light | dark) onto <html saved-theme>.
const KEY = "garden:theme"
const mq = window.matchMedia("(prefers-color-scheme: dark)")
const read = (): "system" | "light" | "dark" => {
  try {
    const v = localStorage.getItem(KEY)
    return v === "light" || v === "dark" ? v : "system"
  } catch {
    return "system"
  }
}
const apply = () => {
  const pref = read()
  const theme = pref === "system" ? (mq.matches ? "dark" : "light") : pref
  document.documentElement.setAttribute("saved-theme", theme)
  document.dispatchEvent(new CustomEvent("themechange", { detail: { theme } }))
}
apply()
mq.addEventListener("change", apply)
;(window as any).gardenSetTheme = (pref: "system" | "light" | "dark") => {
  try {
    pref === "system" ? localStorage.removeItem(KEY) : localStorage.setItem(KEY, pref)
  } catch {}
  apply()
}

// Text size: a scale factor on the root font size, applied before first paint.
const SCALE_KEY = "garden:scale"
const applyScale = () => {
  let n = 1
  try { n = Number(localStorage.getItem(SCALE_KEY)) || 1 } catch {}
  document.documentElement.style.setProperty("--garden-text-scale", String(n))
}
applyScale()
;(window as any).gardenSetScale = (n: number) => {
  try { n === 1 ? localStorage.removeItem(SCALE_KEY) : localStorage.setItem(SCALE_KEY, String(n)) } catch {}
  applyScale()
}
