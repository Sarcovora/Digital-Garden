import { QuartzTransformerPlugin } from "../types"

// Obsidian renders [text](Some Note.md) as a link; CommonMark only does so when the target is wrapped in <...>.
// Wrap spaced targets that carry no title, leaving [a](url "title") and external URLs alone.
export const SpacedLinkTargets: QuartzTransformerPlugin = () => ({
  name: "SpacedLinkTargets",
  textTransform(_ctx, src) {
    return String(src).replace(/\[([^\]\n]*)\]\(([^()<>"\n]*\S[ \t]+[^()<>"'\n]*\S)\)/g, (m, text, target) =>
      /^[a-z][a-z0-9+.-]*:/i.test(target) ? m : `[${text}](<${target}>)`,
    )
  },
})
