import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { compileMelody, DRUM_PROGRAMS, exportMidiBytes, GM_PROGRAMS, parse, skipInitialRests } from "../index.js";
import { inferContentPageWidth, renderSvg } from "../renderer/index.js";
import { exportBrowserMp3Bytes, exportBrowserWavBytes } from "./audio-export.js";
import { PreviewAudioPlayer } from "./audio.js";
import scale from "../../examples/scale.jpu?raw";
import twinkle from "../../examples/twinkle.jpu?raw";
import odeToJoy from "../../examples/ode-to-joy.jpu?raw";
import _68example from "../../examples/6-8-example.jpu?raw";
import drums from "../../examples/drums.jpu?raw";
import jingleBells from "../../examples/jingle-bells.jpu?raw";
import happyBirthday from "../../examples/happy-birthday.jpu?raw";
import dearLittleWish from "../../examples/dear-little-wish.jpu?raw";
import burningField from "../../examples/burning-field.jpu?raw";
import blockyHeroes from "../../examples/blocky-heroes.jpu?raw";
import shining from "../../examples/shining-from-the-underground.jpu?raw";

const examples = [
  { name: "Scale", source: scale },
  { name: "Twinkle", source: twinkle },
  { name: "Ode to Joy", source: odeToJoy },
  { name: "6/8 Example", source: _68example },
  { name: "Drums", source: drums },
  { name: "Jingle Bells", source: jingleBells },
  { name: "Happy Birthday", source: happyBirthday },
  { name: "Dear Little Wish", source: dearLittleWish },
  { name: "Burning Field", source: burningField },
  { name: "Blocky Heroes", source: blockyHeroes },
  { name: "Shining", source: shining },
];

const MELODIC_AUDITION_SOURCE = "1 2 3 4 5 6 7 1'";
const DRUM_AUDITION_SOURCE = "X X X X";
const LIGHT_THEME = {
  scoreColor: "#111827",
  pageBackground: "#ffffff",
};
const DARK_THEME = {
  scoreColor: "#f8fafc",
  pageBackground: "#111827",
};
const THEME_STORAGE_KEY = "modern-jianpu-markup-theme";
const LANGUAGE_STORAGE_KEY = "modern-jianpu-markup-language";
const DEFAULT_PAGE_WIDTH = 1000;
const MIN_PAGE_WIDTH = 240;
const MAX_PAGE_WIDTH = 2000;
const PREVIEW_HORIZONTAL_PADDING = 32;

type ThemeName = "light" | "dark";
type Language = "en" | "zh";
type PageWidthMode = "panel" | "content" | "manual";
type JustifyMode = "none" | "except-last" | "all";
type TranslationKey =
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
  | "program"
  | "generalMidi"
  | "drums"
  | "volume"
  | "audioSampleRate"
  | "omitInitialRests"
  | "audition"
  | "source"
  | "sourcePlaceholder"
  | "preview"
  | "noPreview"
  | "previewSummary"
  | "fixParseErrors"
  | "valid"
  | "error"
  | "errors"
  | "validWarning"
  | "validWarnings"
  | "event"
  | "events";

const translations: Record<Language, Record<TranslationKey, string>> = {
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
    program: "Program",
    generalMidi: "General MIDI",
    drums: "Drums",
    volume: "Volume",
    audioSampleRate: "Audio sample rate",
    omitInitialRests: "Omit initial rests",
    audition: "Audition",
    source: "Source",
    sourcePlaceholder: "Enter your Jianpu here...",
    preview: "Preview",
    noPreview: "No preview",
    previewSummary: "{lines} source line(s), {width}px {mode}",
    fixParseErrors: "Fix parse errors to preview.",
    valid: "Valid",
    error: "error",
    errors: "errors",
    validWarning: "Valid, 1 warning",
    validWarnings: "Valid, {count} warnings",
    event: "event",
    events: "events",
  },
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
    program: "音色",
    generalMidi: "通用 MIDI",
    drums: "鼓组",
    volume: "音量",
    audioSampleRate: "音频采样率",
    omitInitialRests: "忽略开头休止符",
    audition: "试听",
    source: "源码",
    sourcePlaceholder: "在这里输入简谱...",
    preview: "预览",
    noPreview: "无预览",
    previewSummary: "{lines} 行源码，{width}px，{mode}",
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

const localizedExampleNames: Record<Language, Record<string, string>> = {
  en: {},
  zh: {
    Scale: "音阶",
    Twinkle: "小星星",
    "Ode to Joy": "欢乐颂",
    "6/8 Example": "6/8 示例",
    Drums: "鼓组",
    "Jingle Bells": "铃儿响叮当",
    "Happy Birthday": "生日快乐",
    "Dear Little Wish": "亲爱的小愿望",
    "Burning Field": "燃烧的原野",
    "Blocky Heroes": "方块英雄",
    Shining: "地下闪光",
  },
};

const pageWidthModeLabels: Record<PageWidthMode, TranslationKey> = {
  panel: "panel",
  content: "content",
  manual: "manual",
};

function translate(language: Language, key: TranslationKey, values: Record<string, string | number> = {}): string {
  return Object.entries(values).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), translations[language][key]);
}

function themeColors(theme: ThemeName) {
  return theme === "light" ? LIGHT_THEME : DARK_THEME;
}

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
}

function isLanguage(value: string | null): value is Language {
  return value === "en" || value === "zh";
}

function storedTheme(): ThemeName | null {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeName(value) ? value : null;
  } catch {
    return null;
  }
}

function systemTheme(): ThemeName {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function storedLanguage(): Language | null {
  try {
    const value = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(value) ? value : null;
  } catch {
    return null;
  }
}

function systemLanguage(): Language {
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

function initialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "light";
  }
  return storedTheme() ?? systemTheme();
}

function initialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }
  return storedLanguage() ?? systemLanguage();
}

function toPageWidthMode(value: string): PageWidthMode {
  return value === "content" || value === "manual" ? value : "panel";
}

function toJustifyMode(value: string): JustifyMode {
  return value === "except-last" || value === "all" ? value : "none";
}

function openGrammarRailroad(language: Language) {
  window.open(language === "zh" ? "grammar.zh.html" : "grammar.html", "_blank", "noopener,noreferrer");
}

function downloadBytes(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  downloadBlob(blob, filename);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function svgDimensions(svgText: string): { width: number; height: number } {
  const document = new DOMParser().parseFromString(svgText, "image/svg+xml");
  const root = document.documentElement;
  const width = Number.parseFloat(root.getAttribute("width") ?? "");
  const height = Number.parseFloat(root.getAttribute("height") ?? "");
  if (Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0) {
    return { width, height };
  }

  const viewBox = root
    .getAttribute("viewBox")
    ?.trim()
    .split(/[\s,]+/)
    .map((part) => Number.parseFloat(part));
  if (viewBox?.length === 4 && Number.isFinite(viewBox[2]) && viewBox[2]! > 0 && Number.isFinite(viewBox[3]) && viewBox[3]! > 0) {
    return { width: viewBox[2]!, height: viewBox[3]! };
  }

  throw new Error("SVG output does not declare export dimensions.");
}

async function svgToPngBlob(svgText: string): Promise<Blob> {
  const { width, height } = svgDimensions(svgText);
  const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not load SVG for PNG export."));
    });
    image.src = url;
    if (image.decode) {
      await image.decode().catch(() => loaded);
    } else {
      await loaded;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width);
    canvas.height = Math.ceil(height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context for PNG export.");
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Could not encode PNG export."));
        }
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function diagnosticSummary(language: Language, ok: boolean, diagnostics: Array<{ severity: "error" | "warning" }>): string {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  if (!ok) {
    return language === "zh"
      ? `${errors}${translate(language, errors === 1 ? "error" : "errors")}`
      : `${errors} ${translate(language, errors === 1 ? "error" : "errors")}`;
  }
  if (warnings > 0) {
    return warnings === 1 ? translate(language, "validWarning") : translate(language, "validWarnings", { count: warnings });
  }
  return translate(language, "valid");
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function audioExportSummary(language: Language, noteCount: number, seconds: number): string {
  const roundedSeconds = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  if (language === "zh") {
    return `${noteCount}${translate(language, noteCount === 1 ? "event" : "events")}，${roundedSeconds}s`;
  }
  return `${noteCount} ${translate(language, noteCount === 1 ? "event" : "events")}, ${roundedSeconds}s`;
}

export function App() {
  const [source, setSource] = useState("");
  const [language, setLanguage] = useState<Language>(() => initialLanguage());
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [pageWidthMode, setPageWidthMode] = useState<PageWidthMode>("panel");
  const [manualPageWidth, setManualPageWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [panelPageWidth, setPanelPageWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [justifyMode, setJustifyMode] = useState<JustifyMode>("none");
  const [theme, setTheme] = useState<ThemeName>(() => initialTheme());
  const [scoreColor, setScoreColor] = useState(() => themeColors(initialTheme()).scoreColor);
  const [pageBackground, setPageBackground] = useState(() => themeColors(initialTheme()).pageBackground);
  const [program, setProgram] = useState(0);
  const [volume, setVolume] = useState(100);
  const [audioSampleRate, setAudioSampleRate] = useState(44100);
  const [omitInitialRests, setOmitInitialRests] = useState(true);
  const [exportingAudio, setExportingAudio] = useState<"wav" | "mp3" | null>(null);
  const [audioExportDetails, setAudioExportDetails] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const playerRef = useRef<PreviewAudioPlayer | null>(null);
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const t = (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values);
  const parsed = useMemo(() => parse(source), [source]);
  const contentPageWidth = useMemo(
    () => (parsed.ok ? inferContentPageWidth(parsed.value, { minWidth: MIN_PAGE_WIDTH, maxWidth: MAX_PAGE_WIDTH }) : DEFAULT_PAGE_WIDTH),
    [parsed],
  );
  const pageWidth = pageWidthMode === "panel" ? panelPageWidth : pageWidthMode === "content" ? contentPageWidth : manualPageWidth;
  const svg = useMemo(
    () =>
      parsed.ok
        ? renderSvg(parsed.value, {
            pageWidth,
            justifyMode,
            activeNoteIndex: activeNoteIndex ?? undefined,
            color: scoreColor,
            background: pageBackground,
          })
        : null,
    [activeNoteIndex, justifyMode, pageBackground, pageWidth, parsed, scoreColor],
  );

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hans" : "en";
  }, [language]);

  useEffect(() => {
    const element = previewPanelRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const updatePanelWidth = () => {
      const width = Math.round(element.getBoundingClientRect().width - PREVIEW_HORIZONTAL_PADDING);
      if (Number.isFinite(width) && width > 0) {
        setPanelPageWidth(Math.min(MAX_PAGE_WIDTH, Math.max(MIN_PAGE_WIDTH, width)));
      }
    };
    updatePanelWidth();

    const observer = new ResizeObserver(updatePanelWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function exportSvg() {
    if (svg) {
      downloadBytes(svg, "jianpu-score.svg", "image/svg+xml");
    }
  }

  async function exportPng() {
    if (!svg) {
      return;
    }
    try {
      downloadBlob(await svgToPngBlob(svg), "jianpu-score.png");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export PNG.");
    }
  }

  function exportMidi() {
    if (parsed.ok) {
      const midi = exportMidiBytes(parsed.value, program, { omitInitialRests });
      const buffer = midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength) as ArrayBuffer;
      downloadBytes(buffer, "jianpu-score.mid", "audio/midi");
    }
  }

  function describeAudioExport(): string {
    if (!parsed.ok) {
      return "";
    }
    const compiled = compileMelody(parsed.value, program);
    const melody = omitInitialRests ? skipInitialRests(compiled) : compiled;
    const secondsPerWholeNote = (60 / melody.tempo) * melody.beatsPerWholeNote;
    const seconds = melody.notes.reduce((sum, note) => sum + note.duration * secondsPerWholeNote, 0);
    return audioExportSummary(language, melody.notes.length, seconds);
  }

  async function exportWav() {
    if (!parsed.ok || exportingAudio) {
      return;
    }
    setExportingAudio("wav");
    setAudioExportDetails(describeAudioExport());
    try {
      await waitForNextFrame();
      const wav = await exportBrowserWavBytes(parsed.value, {
        program,
        sampleRate: audioSampleRate,
        amplitude: Math.min(1, Math.max(0, volume / 100)),
        omitInitialRests,
      });
      const buffer = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
      downloadBytes(buffer, "jianpu-score.wav", "audio/wav");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export WAV.");
    } finally {
      setExportingAudio(null);
      setAudioExportDetails("");
    }
  }

  async function exportMp3() {
    if (!parsed.ok || exportingAudio) {
      return;
    }
    setExportingAudio("mp3");
    setAudioExportDetails(describeAudioExport());
    try {
      await waitForNextFrame();
      const mp3 = await exportBrowserMp3Bytes(parsed.value, {
        program,
        sampleRate: audioSampleRate,
        amplitude: Math.min(1, Math.max(0, volume / 100)),
        omitInitialRests,
      });
      const buffer = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength) as ArrayBuffer;
      downloadBytes(buffer, "jianpu-score.mp3", "audio/mpeg");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export MP3.");
    } finally {
      setExportingAudio(null);
      setAudioExportDetails("");
    }
  }

  function toggleTheme() {
    const nextTheme = theme === "light" ? "dark" : "light";
    const colors = themeColors(nextTheme);
    setTheme(nextTheme);
    setScoreColor(colors.scoreColor);
    setPageBackground(colors.pageBackground);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Theme persistence is optional.
    }
  }

  function toggleLanguage() {
    const nextLanguage = language === "en" ? "zh" : "en";
    setLanguage(nextLanguage);
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
    } catch {
      // Language persistence is optional.
    }
  }

  async function play(startNoteIndex = 0) {
    if (!parsed.ok) {
      return;
    }
    setShowExamples(false);
    const player = playerRef.current ?? new PreviewAudioPlayer();
    playerRef.current = player;
    const compiled = compileMelody(parsed.value, program);
    const melody = startNoteIndex === 0 && omitInitialRests ? skipInitialRests(compiled) : compiled;
    setIsPlaying(true);
    await player.play(
      melody,
      () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
      },
      setActiveNoteIndex,
      startNoteIndex,
      volume / 100,
      program,
    );
  }

  async function auditionProgram() {
    const result = parse(program >= 128 ? DRUM_AUDITION_SOURCE : MELODIC_AUDITION_SOURCE);
    if (!result.ok) {
      return;
    }
    const player = playerRef.current ?? new PreviewAudioPlayer();
    playerRef.current = player;
    setActiveNoteIndex(null);
    setIsPlaying(true);
    await player.play(
      compileMelody(result.value, program),
      () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
      },
      undefined,
      0,
      volume / 100,
      program,
    );
  }

  function stop() {
    setShowExamples(false);
    playerRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
  }

  function loadSource(nextSource: string) {
    stop();
    setSource(nextSource);
    setShowExamples(false);
  }

  function updateSource(nextSource: string) {
    playerRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
    setSource(nextSource);
  }

  function playFromPreview(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>("[data-note-index]") : null;
    const noteIndex = Number(target?.dataset.noteIndex);
    if (Number.isInteger(noteIndex)) {
      void play(noteIndex);
    }
  }

  return (
    <main className={`app-shell theme-${theme}`}>
      <header className="topbar">
        <div>
          <h1>Modern Jianpu Markup</h1>
          <p>{t("tagline")}</p>
        </div>
        <div className="actions">
          <button type="button" onClick={toggleLanguage}>
            {t("language")}: {language === "en" ? t("english") : t("chinese")}
          </button>
          <button type="button" onClick={toggleTheme}>
            {t("theme")}: {theme === "light" ? t("light") : t("dark")}
          </button>
          <button type="button" onClick={() => openGrammarRailroad(language)}>
            {t("help")}
          </button>
          <button type="button" onClick={() => setShowSettings((visible) => !visible)}>
            {t("settings")}
          </button>
          <button type="button" onClick={() => setShowExamples((visible) => !visible)}>
            {t("examples")}
          </button>
          {isPlaying ? (
            <button type="button" onClick={stop}>
              {t("stop")}
            </button>
          ) : (
            <button type="button" onClick={() => void play()} disabled={!parsed.ok}>
              {t("play")}
            </button>
          )}
          <details className="export-menu">
            <summary>{t("export")}</summary>
            <div className="export-menu-items">
              <button type="button" onClick={exportSvg} disabled={!svg}>
                SVG
              </button>
              <button type="button" onClick={() => void exportPng()} disabled={!svg}>
                PNG
              </button>
              <button type="button" onClick={exportMidi} disabled={!parsed.ok}>
                MIDI
              </button>
              <button type="button" onClick={() => void exportWav()} disabled={!parsed.ok || exportingAudio !== null}>
                {exportingAudio === "wav" ? `${t("exporting")} WAV...` : "WAV"}
              </button>
              <button type="button" onClick={() => void exportMp3()} disabled={!parsed.ok || exportingAudio !== null}>
                {exportingAudio === "mp3" ? `${t("exporting")} MP3...` : "MP3"}
              </button>
              {exportingAudio && (
                <p className="export-status">{audioExportDetails ? `${t("renderingLocally")}: ${audioExportDetails}` : `${t("renderingLocally")}...`}</p>
              )}
            </div>
          </details>
        </div>
      </header>

      {showSettings && (
        <section className="settings-panel">
          <div className="panel-title">
            <h2>{t("settingsTitle")}</h2>
            <button type="button" onClick={() => setShowSettings(false)}>
              {t("close")}
            </button>
          </div>
          <div className="settings-sections">
            <section className="settings-section">
              <h3>{t("pageSettings")}</h3>
              <div className="settings-grid">
                <label className="select-control">
                  {t("widthMode")}
                  <select value={pageWidthMode} onChange={(event) => setPageWidthMode(toPageWidthMode(event.target.value))}>
                    <option value="panel">{t("panel")}</option>
                    <option value="content">{t("content")}</option>
                    <option value="manual">{t("manual")}</option>
                  </select>
                </label>
                <label className="number-control">
                  {t("width")}
                  <input
                    type="number"
                    min={MIN_PAGE_WIDTH}
                    max={MAX_PAGE_WIDTH}
                    step={20}
                    value={pageWidthMode === "panel" ? panelPageWidth : pageWidthMode === "content" ? contentPageWidth : manualPageWidth}
                    disabled={pageWidthMode !== "manual"}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value) && value > 0) {
                        setManualPageWidth(Math.min(MAX_PAGE_WIDTH, Math.max(MIN_PAGE_WIDTH, Math.round(value))));
                      }
                    }}
                  />
                </label>
                <label className="color-control">
                  {t("color")}
                  <input type="color" value={scoreColor} onChange={(event) => setScoreColor(event.target.value)} />
                </label>
                <label className="color-control">
                  {t("page")}
                  <input type="color" value={pageBackground} onChange={(event) => setPageBackground(event.target.value)} />
                </label>
                <label className="select-control">
                  {t("justify")}
                  <select value={justifyMode} onChange={(event) => setJustifyMode(toJustifyMode(event.target.value))}>
                    <option value="none">{t("none")}</option>
                    <option value="except-last">{t("exceptLastLine")}</option>
                    <option value="all">{t("allLines")}</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="settings-section">
              <h3>{t("soundSettings")}</h3>
              <div className="settings-grid">
                <label className="select-control">
                  {t("program")}
                  <select
                    value={program}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value >= 0 && value <= 220) {
                        setProgram(value);
                      }
                    }}
                  >
                    <optgroup label={t("generalMidi")}>
                      {GM_PROGRAMS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label={t("drums")}>
                      {DRUM_PROGRAMS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="range-control">
                  {t("volume")}
                  <input
                    type="range"
                    min={0}
                    max={200}
                    step={1}
                    value={volume}
                    onChange={(event) => setVolume(Number(event.target.value))}
                  />
                  <span>{Math.round(volume)}%</span>
                </label>
                <label className="number-control">
                  {t("audioSampleRate")}
                  <input
                    type="number"
                    min={8000}
                    max={192000}
                    step={1000}
                    value={audioSampleRate}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value) && value > 0) {
                        setAudioSampleRate(Math.round(value));
                      }
                    }}
                  />
                </label>
                <label className="checkbox-control">
                  <input
                    type="checkbox"
                    checked={omitInitialRests}
                    onChange={(event) => setOmitInitialRests(event.target.checked)}
                  />
                  {t("omitInitialRests")}
                </label>
                <button type="button" onClick={() => void auditionProgram()}>
                  {t("audition")}
                </button>
              </div>
            </section>
          </div>
        </section>
      )}

      {showExamples && (
        <section className="examples-panel">
          <div className="panel-title">
            <h2>{t("examples")}</h2>
            <button type="button" onClick={() => setShowExamples(false)}>
              {t("close")}
            </button>
          </div>
          <div className="examples-grid">
            {examples.map((example) => (
              <button
                key={example.name}
                type="button"
                onClick={() => loadSource(example.source)}
              >
                {localizedExampleNames[language][example.name] ?? example.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="workspace">
        <section className="editor-panel">
          <div className="panel-title">
            <h2>{t("source")}</h2>
            <span className={parsed.ok ? (parsed.diagnostics.length > 0 ? "status-warning" : "status-ok") : "status-error"}>
              {diagnosticSummary(language, parsed.ok, parsed.diagnostics)}
            </span>
          </div>
          <textarea
            value={source}
            onChange={(event) => updateSource(event.target.value)}
            onFocus={() => setShowExamples(false)}
            placeholder={t("sourcePlaceholder")}
            spellCheck={false}
          />
          {parsed.diagnostics.length > 0 && (
            <div className="diagnostics">
              {parsed.diagnostics.map((diagnostic, index) => (
                <p key={index} className={diagnostic.severity}>
                  {diagnostic.range
                    ? `${diagnostic.range.start.line}:${diagnostic.range.start.column} ${diagnostic.message}`
                    : diagnostic.message}
                </p>
              ))}
            </div>
          )}
        </section>

        <section className="preview-panel" ref={previewPanelRef}>
          <div className="panel-title">
            <h2>{t("preview")}</h2>
            <span>
              {parsed.ok
                ? t("previewSummary", {
                    lines: parsed.value.score.length,
                    width: pageWidth,
                    mode: t(pageWidthModeLabels[pageWidthMode]),
                  })
                : t("noPreview")}
            </span>
          </div>
          <div className="preview-scroll" onClick={playFromPreview}>
            {svg ? <div className="score-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <p>{t("fixParseErrors")}</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
