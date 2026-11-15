export type Language = "en" | "zh";
export type PageWidthMode = "panel" | "content" | "manual";
export type JustifyMode = "none" | "except-last" | "all";
export type TranslationKey =
  | "appName"
  | "exportVideo"
  | "videoPreparing"
  | "videoRendering"
  | "videoFinalizing"
  | "videoUnsupported"
  | "videoFailed"
  | "audioPreparing"
  | "audioDownloading"
  | "audioFirstLoad"
  | "audioLoadFailed"
  | "language"
  | "english"
  | "chinese"
  | "theme"
  | "light"
  | "dark"
  | "help"
  | "settings"
  | "examples"
  | "open"
  | "save"
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
  | "exportSettings"
  | "paper"
  | "custom"
  | "orientation"
  | "portrait"
  | "landscape"
  | "widthMode"
  | "panel"
  | "content"
  | "manual"
  | "width"
  | "paginate"
  | "pageHeight"
  | "pageMargin"
  | "pageNumbers"
  | "measureNumbers"
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
  | "pngScale"
  | "pngSize"
  | "splitPages"
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

const translations: { en: Record<TranslationKey, string>; zh: Record<TranslationKey, string> } = {
  en: {
    appName: "Potato Jianpu",
    exportVideo: "MP4 (Experimental)",
    videoPreparing: "Preparing playback video…",
    videoRendering: "Exporting playback video: {percent}%",
    videoFinalizing: "Finishing video file…",
    videoUnsupported: "This browser cannot encode playback video. Try a current desktop Chrome or Edge browser over HTTPS or localhost.",
    videoFailed: "Could not export playback video. Try a shorter score or another browser.",
    audioPreparing: "Preparing audio…",
    audioDownloading: "Downloading sound bank…",
    audioFirstLoad: "The sound bank loads on first use and is reused on this page.",
    audioLoadFailed: "Unable to load audio. Check your connection and try again.",
    language: "Language",
    english: "English",
    chinese: "中文",
    theme: "Theme",
    light: "Light",
    dark: "Dark",
    help: "Help",
    settings: "Settings",
    examples: "Examples",
    open: "Open",
    save: "Save",
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
    overwriteScoreMessage: "This will replace the score currently in the editor.",
    overwriteScoreConfirm: "Replace score",
    pageSettings: "Page Settings",
    exportSettings: "Export Settings",
    paper: "Paper",
    custom: "Custom",
    orientation: "Orientation",
    portrait: "Portrait",
    landscape: "Landscape",
    widthMode: "Width mode",
    panel: "Panel",
    content: "Content",
    manual: "Manual",
    width: "Width",
    paginate: "Paginate",
    pageHeight: "Page height",
    pageMargin: "Page margin",
    pageNumbers: "Page numbers",
    measureNumbers: "Measure numbers",
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
    audioSampleRate: "Audio sample rate (WAV/MP3)",
    pngScale: "PNG scale",
    pngSize: "PNG size: {width} × {height} px",
    splitPages: "Split pages (SVG/PNG)",
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
    previewSummary: "{lines} source line(s), {width}px {mode}, {pages} page(s)",
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
    appName: "土豆简谱",
    exportVideo: "MP4（实验）",
    videoPreparing: "正在准备播放视频…",
    videoRendering: "正在导出播放视频：{percent}%",
    videoFinalizing: "正在生成视频文件…",
    videoUnsupported: "此浏览器不支持播放视频编码，请尝试使用新版桌面 Chrome 或 Edge，并通过 HTTPS 或 localhost 打开。",
    videoFailed: "播放视频导出失败，请尝试较短的乐谱或其他浏览器。",
    audioPreparing: "正在准备音频…",
    audioDownloading: "正在下载音源…",
    audioFirstLoad: "首次使用需要加载音源，之后在此页面中复用。",
    audioLoadFailed: "无法加载音频，请检查网络连接后重试。",
    language: "语言",
    english: "English",
    chinese: "中文",
    theme: "主题",
    light: "浅色",
    dark: "深色",
    help: "帮助",
    settings: "设置",
    examples: "示例",
    open: "打开",
    save: "保存",
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
    overwriteScoreMessage: "这会替换编辑器中当前的乐谱。",
    overwriteScoreConfirm: "覆盖乐谱",
    pageSettings: "页面设置",
    exportSettings: "导出设置",
    paper: "纸张",
    custom: "自定义",
    orientation: "方向",
    portrait: "纵向",
    landscape: "横向",
    widthMode: "宽度模式",
    panel: "面板",
    content: "内容",
    manual: "手动",
    width: "宽度",
    paginate: "分页",
    pageHeight: "页高",
    pageMargin: "页边距",
    pageNumbers: "页码",
    measureNumbers: "小节编号",
    color: "谱面颜色",
    page: "页面",
    justify: "两端对齐",
    none: "无",
    exceptLastLine: "除最后一行",
    allLines: "所有行",
    soundSettings: "声音设置",
    editorSettings: "编辑器设置",
    program: "音色",
    trackProgramOverrides: "{count} 个声部音色覆盖",
    generalMidi: "通用 MIDI",
    drums: "鼓组",
    volume: "音量",
    audioSampleRate: "音频采样率（WAV/MP3）",
    pngScale: "PNG 倍率",
    pngSize: "PNG 尺寸：{width} × {height} px",
    splitPages: "拆分页（SVG/PNG）",
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
    previewSummary: "{lines} 行源码，{width}px，{mode}，{pages} 页",
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
