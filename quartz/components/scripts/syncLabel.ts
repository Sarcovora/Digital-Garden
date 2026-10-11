export interface SyncStatus {
  state: "idle" | "building" | "failed"
  behind: number
  lastSyncedAt: string | null
  error: string | null
  checkError: string | null
}

export function relative(iso: string | null, now: number): string {
  if (!iso) return "never"
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000))
  if (s < 60) return "just now"
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"} ago`
  if (s < 3600) return unit(Math.floor(s / 60), "minute")
  if (s < 86400) return unit(Math.floor(s / 3600), "hour")
  return unit(Math.floor(s / 86400), "day")
}

// What the sync button says and whether it can be pressed, from the server's status.
export function labelFor(s: SyncStatus, now: number) {
  const when = `Last synced ${relative(s.lastSyncedAt, now)}`
  if (s.state === "building") return { label: "Syncing…", disabled: true, busy: true, note: "Rebuilding the garden" }
  if (s.state === "failed") return { label: "Sync failed · retry", disabled: false, busy: false, note: s.error ?? "Unknown error" }
  if (s.checkError) return { label: "Check again", disabled: false, busy: false, note: `Can't reach GitHub. ${when}` }
  if (s.behind > 0)
    return { label: `Sync · ${s.behind} new commit${s.behind === 1 ? "" : "s"}`, disabled: false, busy: false, note: when }
  return { label: "Up to date", disabled: true, busy: false, note: when }
}
