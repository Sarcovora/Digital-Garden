// A back-swipe starts in a narrow strip near the left edge (not at x<10, where iOS's own edge gesture lives),
// travels right far enough, mostly horizontally, and quickly enough to be a flick rather than a scroll or press.
export function classifySwipe(g: { startX: number; startY: number; endX: number; endY: number; ms: number }): "back" | null {
  const dx = g.endX - g.startX
  const dy = Math.abs(g.endY - g.startY)
  if (g.startX < 10 || g.startX > 40) return null
  if (dx < 70) return null
  if (dy > dx * 0.6) return null
  if (g.ms > 1000) return null
  return "back"
}
