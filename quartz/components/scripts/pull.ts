// Pull down from the very top of a page, like pull-to-refresh, to bring up search.
export const PULL_THRESHOLD = 90

// 0 to 1: how far along a pull is. A drag that began while the page was scrolled, that goes up, or that is
// mostly sideways is not a pull.
export function pullProgress(g: { startScrollY: number; startX: number; startY: number; x: number; y: number }): number {
  if (g.startScrollY > 0) return 0
  const dy = g.y - g.startY
  const dx = Math.abs(g.x - g.startX)
  if (dy <= 0 || dx > dy) return 0
  return Math.min(1, dy / PULL_THRESHOLD)
}
