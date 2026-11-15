# 土豆简谱 · Potato Jianpu

[中文](#中文) | [English](#english)

## 中文

土豆简谱是一个基于 TypeScript 的工具集和浏览器应用，用于解析、渲染、播放和导出简谱。

当前功能：

- 手写词法分析器和解析器
- 共享的核心文档模型
- CLI 支持 `parse`、`validate`、`export-svg`、`export-png`、`export-pdf`、`export-midi`、`export-wav` 和 `export-mp3`
- 后端支持 WAV 和 MP3 导出
- 浏览器支持谱面预览，以及 SVG、PNG、PDF、MIDI、WAV 和 MP3 导出
- 浏览器支持导出谱面高亮与音频同步的播放视频
- 浏览器支持打开和保存 `.jpu` 文件
- 浏览器播放时高亮当前音符，并支持点击预览中的音符开始播放
- 使用 Astro Starlight 和 MDX 构建的文档站
- `examples/` 中提供示例乐谱
- 使用 Node 内置测试运行器测试解析器、渲染器、播放器、后端、CLI 和示例

播放和 WAV/MP3 导出使用 SpessaSynth，以及随项目提供的 GeneralUser GS 2.0.3 采样音色库。浏览器在首次使用时加载约 32 MB 的音色库；CLI 导出使用本地副本。

### 常用命令

```sh
pnpm install
pnpm run build
pnpm run check
pnpm run test
pnpm run cli -- --version
pnpm run cli -- validate path/to/score.jpu
pnpm run cli -- validate path/to/score.jpu --json
pnpm run cli -- parse path/to/score.jpu --json
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff"
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --paginate --split-pages
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff" --png-scale 2
pnpm run cli -- export-pdf examples/twinkle.jpu -o twinkle.pdf --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid --program 0
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav --program 0 --sample-rate 44100 --amplitude 1
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
pnpm run dev
pnpm run docs:dev
pnpm run web:build
pnpm run docs:build
pnpm run docs:i18n
pnpm run docs:examples
```

本仓库在 `package.json` 中指定使用 `pnpm@8.10.3` 作为包管理器。

### 乐谱文件头

文件头只接受规定的字段，每个字段都有明确的类型。文本值使用引号，音乐默认值使用各自的值语法：

```jpu
title: "Twinkle"
key: C
time: 4/4
tempo: 96
hidden: false
measureNumbers: true
program: 24
volume: 85%
T1.program: "Violin"
T1.volume: 0.8
P1.program: 128
===
T1: 1 1 5 5 | 6 6 5 - |
P1: X 0 X 0 | X 0 X 0 |
```

使用 `program` 和 `volume` 设置整份乐谱的播放与导出默认值，使用 `Tn.program` 和 `Tn.volume` 覆盖旋律轨道的设置，使用 `Pn.program` 或 `Pn.volume` 设置以 P 标记的打击乐轨道。未设置乐谱级 Program 时，CLI 和浏览器中的 Program 控件仍提供默认值。

### 构建产物

`pnpm run build` 将后端 CLI 和共享库模块输出到 `dist/`。包元数据将 `jianpu` 暴露为 CLI 命令，并导出共享的核心、解析器、渲染器、播放器和后端模块。

`pnpm run web:build` 将浏览器应用输出到 `dist-web/`，并将文档站构建到 `dist-web/docs/`。`pnpm run docs:build` 可以单独将文档站构建到同一子目录。

仓库交接说明见 `AGENTS.md`，完整命令参考见 `docs/COMMANDS.md`。面向用户的语法文档位于 `docs-site/src/content/docs/`；语法铁路图由 `docs/grammar.ebnf` 生成。模块边界见 `docs/ARCHITECTURE.md`，渲染器行为见 `docs/RENDERER.md`，播放器行为见 `docs/PLAYER.md`，导出行为见 `docs/EXPORTS.md`，质量规范见 `docs/QUALITY.md`，翻译规则见 `docs/TRANSLATION.md`，后续计划见 `docs/ROADMAP.md`，发布方式见 `docs/RELEASE.md`。

## English

Potato Jianpu is a TypeScript toolkit and browser app for parsing,
rendering, playing, and exporting Jianpu scores.

Current status:

- hand-written tokenizer/parser
- shared core document model
- CLI with `parse`, `validate`, `export-svg`, `export-png`, `export-pdf`, `export-midi`, `export-wav`, and `export-mp3`
- backend WAV and MP3 export
- frontend web preview with SVG, PNG, PDF, MIDI, WAV, and MP3 export
- frontend playback video export with synchronized score highlighting and audio
- frontend `.jpu` open/save
- browser playback with current-note highlighting and click-to-play preview notes
- Astro Starlight documentation site built from MDX
- example scores in `examples/`
- Node built-in test runner for parser, renderer, player, backend, CLI, and examples

Playback and WAV/MP3 export use SpessaSynth with the bundled GeneralUser GS
2.0.3 sampled sound bank. The browser loads the approximately 32 MB bank on
first use; CLI exports use the local copy.

### Commands

```sh
pnpm install
pnpm run build
pnpm run check
pnpm run test
pnpm run cli -- --version
pnpm run cli -- validate path/to/score.jpu
pnpm run cli -- validate path/to/score.jpu --json
pnpm run cli -- parse path/to/score.jpu --json
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff"
pnpm run cli -- export-svg examples/twinkle.jpu -o twinkle.svg --paper a4 --paginate --split-pages
pnpm run cli -- export-png examples/twinkle.jpu -o twinkle.png --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff" --png-scale 2
pnpm run cli -- export-pdf examples/twinkle.jpu -o twinkle.pdf --paper a4 --orientation portrait --paginate --color "#111827" --background "#ffffff"
pnpm run cli -- export-midi examples/twinkle.jpu -o twinkle.mid --program 0
pnpm run cli -- export-wav examples/twinkle.jpu -o twinkle.wav --program 0 --sample-rate 44100 --amplitude 1
pnpm run cli -- export-mp3 examples/twinkle.jpu -o twinkle.mp3 --program 0 --sample-rate 44100 --amplitude 1 --bit-rate 128
pnpm run dev
pnpm run docs:dev
pnpm run web:build
pnpm run docs:build
pnpm run docs:i18n
pnpm run docs:examples
```

This repository records `pnpm@8.10.3` in `package.json` as the expected package
manager.

### Score Header

Header fields are typed and closed. Text fields stay quoted, while musical
defaults use their own value syntax:

```jpu
title: "Twinkle"
key: C
time: 4/4
tempo: 96
hidden: false
measureNumbers: true
program: 24
volume: 85%
T1.program: "Violin"
T1.volume: 0.8
P1.program: 128
===
T1: 1 1 5 5 | 6 6 5 - |
P1: X 0 X 0 | X 0 X 0 |
```

Use `program` and `volume` for score-level playback/export defaults,
`Tn.program` and `Tn.volume` for melodic track overrides, and `Pn.program` or
`Pn.volume` for P-labeled percussion tracks. The CLI and browser Program
controls remain the default for tracks without a score-level Program.

### Built Outputs

`pnpm run build` emits the backend CLI and shared library modules in `dist/`.
The package metadata exposes `jianpu` as the CLI binary and exports the shared
core, parser, renderer, player, and backend modules.

`pnpm run web:build` emits the browser application in `dist-web/` and builds
the documentation site under `dist-web/docs/`. `pnpm run docs:build` builds the
documentation site by itself at the same subpath.

See `AGENTS.md` for repository handoff notes and `docs/COMMANDS.md` for the
full command reference. User-facing syntax documentation lives in
`docs-site/src/content/docs/`; grammar railroad diagrams are generated from
`docs/grammar.ebnf`. Module boundaries are documented in
`docs/ARCHITECTURE.md`, renderer behavior in `docs/RENDERER.md`, player
behavior in `docs/PLAYER.md`, export behavior in `docs/EXPORTS.md`, quality
policy in `docs/QUALITY.md`, translation rules in `docs/TRANSLATION.md`, future
work in `docs/ROADMAP.md`, and release shape in `docs/RELEASE.md`.
