// Small haptic ticks for touch feedback. iOS has no navigator.vibrate, but 18+ ticks when a hidden
// <input type="checkbox" switch> is toggled, so we click one (from inside a user gesture). Elsewhere vibrate() is used.
export type Haptic = "light" | "select" | "success" | "warn"

const TICKS: Record<Haptic, number> = { light: 1, select: 1, success: 2, warn: 3 }
const VIBRATE: Record<Haptic, number | number[]> = { light: 8, select: 6, success: [10, 45, 14], warn: [14, 40, 14, 40, 14] }
const GAP_MS = 70

interface Env {
  doc?: Document
  nav?: { vibrate?: (p: number | number[]) => boolean }
  enabled: () => boolean
  later: (fn: () => void, ms: number) => void
}

export function createHaptics(env: Env) {
  let label: HTMLLabelElement | undefined
  const ensureSwitch = () => {
    const doc = env.doc
    if (!doc?.body) return undefined
    if (label?.isConnected) return label
    label = doc.createElement("label")
    label.setAttribute("aria-hidden", "true")
    label.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden"
    const input = doc.createElement("input")
    input.type = "checkbox"
    input.setAttribute("switch", "")
    input.tabIndex = -1
    label.append(input)
    // the synthetic click must not reach the page's own click handlers (an outside-click would close the open menu)
    label.addEventListener("click", (e) => e.stopPropagation())
    doc.body.append(label)
    return label
  }
  const tick = () => { try { ensureSwitch()?.click() } catch {} }
  return {
    fire(kind: Haptic) {
      try {
        if (!env.enabled()) return
        if (typeof env.nav?.vibrate === "function") return void env.nav.vibrate(VIBRATE[kind])
        tick()
        for (let i = 1; i < TICKS[kind]; i++) env.later(tick, i * GAP_MS)
      } catch {}
    },
  }
}

// The app-wide instance. Turn haptics off with localStorage["garden:haptics"] = "off".
const real = createHaptics({
  doc: typeof document === "undefined" ? undefined : document,
  nav: typeof navigator === "undefined" ? undefined : (navigator as any),
  enabled: () => { try { return localStorage.getItem("garden:haptics") !== "off" } catch { return true } },
  later: (fn, ms) => void setTimeout(fn, ms),
})
export const haptic = (kind: Haptic = "light") => real.fire(kind)
