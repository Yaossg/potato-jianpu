import mdx from "@astrojs/mdx";
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";

export default defineConfig({
  base: "/docs",
  outDir: "../dist-web/docs",
  integrations: [
    starlight({
      title: "Modern Jianpu Markup",
      description: "Documentation for writing, rendering, playing, and exporting Jianpu scores.",
      favicon: "/favicon.svg",
      head: [
        { tag: "meta", attrs: { name: "theme-color", content: "#13251f" } },
        { tag: "link", attrs: { rel: "manifest", href: "/docs/site.webmanifest" } },
      ],
      defaultLocale: "root",
      expressiveCode: {
        shiki: {
          langAlias: {
            jpu: "text",
            ebnf: "text",
          },
        },
      },
      locales: {
        root: {
          label: "English",
          lang: "en",
        },
        zh: {
          label: "简体中文",
          lang: "zh-CN",
        },
      },
      sidebar: [
        {
          label: "Start",
          translations: {
            "zh-CN": "开始",
          },
          items: [
            {
              label: "Overview",
              slug: "index",
              translations: {
                "zh-CN": "概览",
              },
            },
          ],
        },
        {
          label: "Syntax",
          translations: {
            "zh-CN": "语法",
          },
          items: [
            {
              label: "Syntax Overview",
              slug: "syntax/overview",
              translations: {
                "zh-CN": "语法概览",
              },
            },
            {
              label: "File Header",
              slug: "syntax/header",
              translations: {
                "zh-CN": "文件头",
              },
            },
            {
              label: "Notes",
              slug: "syntax/notes",
              translations: {
                "zh-CN": "音符",
              },
            },
            {
              label: "Rhythm",
              slug: "syntax/rhythm",
              translations: {
                "zh-CN": "节奏",
              },
            },
            {
              label: "Dynamics",
              slug: "syntax/dynamics",
              translations: {
                "zh-CN": "力度",
              },
            },
            {
              label: "Repeats",
              slug: "syntax/repeats",
              translations: {
                "zh-CN": "反复",
              },
            },
            {
              label: "Lyrics and Tracks",
              slug: "syntax/lyrics-tracks",
              translations: {
                "zh-CN": "歌词与多轨",
              },
            },
          ],
        },
        {
          label: "Guide",
          translations: {
            "zh-CN": "指南",
          },
          items: [
            {
              label: "Browser App",
              slug: "guide/browser-app",
              translations: {
                "zh-CN": "浏览器 App",
              },
            },
            {
              label: "CLI",
              slug: "guide/cli",
              translations: {
                "zh-CN": "命令行",
              },
            },
            {
              label: "Playback",
              slug: "guide/playback",
              translations: {
                "zh-CN": "播放",
              },
            },
            {
              label: "Export",
              slug: "guide/export",
              translations: {
                "zh-CN": "导出",
              },
            },
          ],
        },
        {
          label: "Reference",
          translations: {
            "zh-CN": "参考",
          },
          items: [
            {
              label: "Grammar",
              slug: "reference/grammar",
              translations: {
                "zh-CN": "语法参考",
              },
            },
          ],
        },
      ],
    }),
    mdx(),
  ],
});
