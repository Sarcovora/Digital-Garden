import { readFileSync, existsSync } from "fs"
import path from "path"
import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
// @ts-ignore
import { parsePreamble } from "./scripts/preamble-to-katex.mjs"

// KaTeX macros from the vault's MathJax preamble, when the vault provides one.
const preamble = path.join(process.env.GARDEN_VAULT ?? "", "preamble.sty")
const customMacros: Record<string, string> =
  process.env.GARDEN_VAULT && existsSync(preamble) ? parsePreamble(readFileSync(preamble, "utf8")) : {}

// Colors mirror quartz/styles/_garden-tokens.scss (scripts/tokens-sync.test.mjs keeps them equal).
const config: QuartzConfig = {
  configuration: {
    pageTitle: "Garden",
    pageTitleSuffix: "",
    enableSPA: true,
    enablePopovers: false,
    analytics: null,
    locale: "en-US",
    // The real host (a tailnet name) is deliberately not committed. Nothing reads baseUrl (sitemap and RSS are off); set GARDEN_BASE_URL if that changes.
    baseUrl: process.env.GARDEN_BASE_URL ?? "garden.invalid",
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian*",
      ".git",
      ".trash",
      "**/*.sty",
      "*.bash",
      ".gitignore",
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "local",
      cdnCaching: false,
      typography: {
        header: "Literata Variable",
        body: "Literata Variable",
        code: "ui-monospace",
      },
      colors: {
        lightMode: {
          light: "#f4f5f0",
          lightgray: "#d5d8d2",
          gray: "#4a4f52",
          darkgray: "#4a4f52",
          dark: "#16181a",
          secondary: "#7a1f1f",
          tertiary: "#a98a3e",
          highlight: "rgba(169, 138, 62, 0.14)",
          textHighlight: "#a98a3e55",
        },
        darkMode: {
          light: "#121314",
          lightgray: "#2a2c2d",
          gray: "#a3a39b",
          darkgray: "#a3a39b",
          dark: "#e7e6df",
          secondary: "#d2655e",
          tertiary: "#c9a659",
          highlight: "rgba(201, 166, 89, 0.16)",
          textHighlight: "#c9a65955",
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.Excalidraw(),
      Plugin.CreatedModifiedDate({ priority: ["frontmatter", "filesystem"] }),
      Plugin.GitDates(),
      Plugin.SyntaxHighlighting({
        theme: { light: "github-light", dark: "github-dark" },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false, parseBlockReferences: true }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex", customMacros }),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({ enableSiteMap: false, enableRSS: false }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.NotFoundPage(),
      Plugin.GardenIndex(),
      Plugin.GardenHome(),
      Plugin.GardenServiceWorker(),
    ],
  },
}

export default config
