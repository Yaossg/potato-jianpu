export type Language = "en" | "zh";
export type PageWidthMode = "panel" | "content" | "manual";
export type JustifyMode = "none" | "except-last" | "all";
export type TranslationKey =
  | "tagline"
  | "language"
  | "english"
  | "chinese"
  | "theme"
  | "light"
  | "dark"
  | "help"
  | "settings"
  | "examples"
  | "stop"
  | "play"
  | "export"
  | "exporting"
  | "renderingLocally"
  | "settingsTitle"
  | "close"
  | "cancel"
  | "clear"
  | "clearScoreTitle"
  | "clearScoreMessage"
  | "clearScoreConfirm"
  | "overwriteScoreTitle"
  | "overwriteScoreMessage"
  | "overwriteScoreConfirm"
  | "pageSettings"
  | "widthMode"
  | "panel"
  | "content"
  | "manual"
  | "width"
  | "color"
  | "page"
  | "justify"
  | "none"
  | "exceptLastLine"
  | "allLines"
  | "soundSettings"
  | "editorSettings"
  | "program"
  | "trackProgramOverrides"
  | "generalMidi"
  | "drums"
  | "volume"
  | "audioSampleRate"
  | "omitInitialRests"
  | "sourceWrap"
  | "editorFontSize"
  | "showLineNumbers"
  | "highlightCurrentLine"
  | "highlightDiagnostics"
  | "audition"
  | "source"
  | "sourcePlaceholder"
  | "preview"
  | "noPreview"
  | "previewSummary"
  | "stalePreview"
  | "fixParseErrors"
  | "valid"
  | "error"
  | "errors"
  | "validWarning"
  | "validWarnings"
  | "event"
  | "events";

const translations: { en: Record<TranslationKey, string>; zh: Partial<Record<TranslationKey, string>> } = {
  en: {
    tagline: "Browser preview for the parser, SVG renderer, and audio exporters.",
    language: "Language",
    english: "English",
    chinese: "中文",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    help: "Help",
    settings: "Settings",
    examples: "Examples",
    stop: "Stop",
    play: "Play",
    export: "Export",
    exporting: "Exporting",
    renderingLocally: "Rendering locally",
    settingsTitle: "Settings",
    close: "Close",
    cancel: "Cancel",
    clear: "Clear",
    clearScoreTitle: "Clear editor?",
    clearScoreMessage: "This will remove the current score and clear the saved browser draft.",
    clearScoreConfirm: "Clear editor",
    overwriteScoreTitle: "Replace current score?",
    overwriteScoreMessage: "Loading an example will replace the score currently in the editor.",
    overwriteScoreConfirm: "Replace score",
    pageSettings: "Page Settings",
    widthMode: "Width mode",
    panel: "Panel",
    content: "Content",
    manual: "Manual",
    width: "Width",
    color: "Color",
    page: "Page",
    justify: "Justify",
    none: "None",
    exceptLastLine: "Except last line",
    allLines: "All lines",
    soundSettings: "Sound Settings",
    editorSettings: "Editor Settings",
    program: "Default Program",
    trackProgramOverrides: "{count} score-level track Program override(s)",
    generalMidi: "General MIDI",
    drums: "Drums",
    volume: "Volume",
    audioSampleRate: "Audio sample rate",
    omitInitialRests: "Omit initial rests",
    sourceWrap: "Wrap source lines",
    editorFontSize: "Editor font size",
    showLineNumbers: "Show line numbers",
    highlightCurrentLine: "Highlight current line",
    highlightDiagnostics: "Highlight diagnostics",
    audition: "Audition",
    source: "Source",
    sourcePlaceholder: "Enter your Jianpu here...",
    preview: "Preview",
    noPreview: "No preview",
    previewSummary: "{lines} source line(s), {width}px {mode}",
    stalePreview: "Current source has parse errors. Preview is showing the last valid render and has not updated.",
    fixParseErrors: "Fix parse errors to preview.",
    valid: "Valid",
    error: "error",
    errors: "errors",
    validWarning: "Valid, 1 warning",
    validWarnings: "Valid, {count} warnings",
    event: "event",
    events: "events",
  } satisfies Record<TranslationKey, string>,
  zh: {
    tagline: "用于解析器、SVG 渲染器和音频导出的浏览器预览。",
    language: "语言",
    english: "English",
    chinese: "中文",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    help: "帮助",
    settings: "设置",
    examples: "示例",
    stop: "停止",
    play: "播放",
    export: "导出",
    exporting: "正在导出",
    renderingLocally: "本地渲染中",
    settingsTitle: "设置",
    close: "关闭",
    cancel: "取消",
    clear: "清空",
    clearScoreTitle: "清空编辑器？",
    clearScoreMessage: "这会移除当前乐谱，并清除浏览器中保存的草稿。",
    clearScoreConfirm: "清空编辑器",
    overwriteScoreTitle: "覆盖当前乐谱？",
    overwriteScoreMessage: "加载示例会替换编辑器中当前的乐谱。",
    overwriteScoreConfirm: "覆盖乐谱",
    pageSettings: "页面设置",
    widthMode: "宽度模式",
    panel: "面板",
    content: "内容",
    manual: "手动",
    width: "宽度",
    color: "谱面颜色",
    page: "页面",
    justify: "对齐",
    none: "无",
    exceptLastLine: "除最后一行",
    allLines: "所有行",
    soundSettings: "声音设置",
    editorSettings: "编辑器设置",
    program: "音色",
    generalMidi: "通用 MIDI",
    drums: "鼓组",
    volume: "音量",
    audioSampleRate: "音频采样率",
    omitInitialRests: "忽略开头休止符",
    sourceWrap: "源码自动换行",
    editorFontSize: "编辑器字号",
    showLineNumbers: "显示行号",
    highlightCurrentLine: "高亮当前行",
    highlightDiagnostics: "高亮诊断",
    audition: "试听",
    source: "源码",
    sourcePlaceholder: "在这里输入简谱...",
    preview: "预览",
    noPreview: "无预览",
    previewSummary: "{lines} 行源码，{width}px，{mode}",
    stalePreview: "当前源码有解析错误，预览正在显示上一次有效的渲染结果，尚未更新。",
    fixParseErrors: "修复解析错误后显示预览。",
    valid: "有效",
    error: "个错误",
    errors: "个错误",
    validWarning: "有效，1 个警告",
    validWarnings: "有效，{count} 个警告",
    event: "个事件",
    events: "个事件",
  },
};

export function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "zh";
}

export const pageWidthModeLabels: Record<PageWidthMode, TranslationKey> = {
  panel: "panel",
  content: "content",
  manual: "manual",
};

export function translate(language: Language, key: TranslationKey, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), translations[language][key] ?? translations.en[key]);
}

