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
