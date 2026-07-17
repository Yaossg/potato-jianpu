import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { Diagnostic, Document, Result } from "../core/model.js";
import {
  arrangementDuration,
  arrangementNoteCount,
  compileArrangement,
  exportMidiBytes,
  parse,
  skipInitialArrangementRests,
  trimArrangementAtNote,
} from "../index.js";
import { DEFAULT_PAGE_SIZE, PAPER_PRESET_LIST, analyzeScoreOverwidth, inferContentPageWidth, renderSvg, renderSvgPages, resolvePageSize } from "../renderer/index.js";
import type { OverwideScoreLayoutWarning, PageOrientation, PaperPresetName } from "../renderer/index.js";
import { PreviewAudioPlayer } from "./audio.js";
import { waitForNextFrame } from "./browser-utils.js";
import { DEFAULT_PNG_SCALE, downloadBlob, downloadBytes, pngPixelDimensions, svgToPngBlob } from "./downloads.js";
import { ExamplesPanel } from "./ExamplesPanel.js";
import { exportFilename, splitPageExportFilename } from "./export-filename.js";
import { isLanguage, pageWidthModeLabels, translate } from "./i18n.js";
import { pageLayoutWarnings } from "./page-warnings.js";
import type { PageLayoutWarning } from "./page-warnings.js";
import { PreviewPanel } from "./PreviewPanel.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { SourceEditor } from "./SourceEditor.js";
import { embedSvgDownloadFonts } from "./svg-fonts.js";
import { Toolbar } from "./Toolbar.js";
import { initialTheme, THEME_STORAGE_KEY, themeColors } from "./theme.js";
import type { JustifyMode, Language, PageWidthMode, TranslationKey } from "./i18n.js";
import type { ThemeName } from "./theme.js";

const MELODIC_AUDITION_SOURCE = "1 2 3 4 5 6 7 1'";
const DRUM_AUDITION_SOURCE = "X X X X";
const LANGUAGE_STORAGE_KEY = "modern-jianpu-markup-language";
const SOURCE_STORAGE_KEY = "modern-jianpu-markup-source";
const SOURCE_WRAP_STORAGE_KEY = "modern-jianpu-markup-source-wrap";
const EDITOR_FONT_SIZE_STORAGE_KEY = "modern-jianpu-markup-editor-font-size";
const SHOW_LINE_NUMBERS_STORAGE_KEY = "modern-jianpu-markup-show-line-numbers";
const HIGHLIGHT_CURRENT_LINE_STORAGE_KEY = "modern-jianpu-markup-highlight-current-line";
const HIGHLIGHT_DIAGNOSTICS_STORAGE_KEY = "modern-jianpu-markup-highlight-diagnostics";
const EDITOR_PANE_PERCENT_STORAGE_KEY = "modern-jianpu-markup-editor-pane-percent";
type PaperSelection = PaperPresetName | "custom";

const DEFAULT_PAGE_WIDTH = DEFAULT_PAGE_SIZE.pageWidth;
const DEFAULT_PAGE_HEIGHT = DEFAULT_PAGE_SIZE.pageHeight;
const DEFAULT_PAGE_MARGIN = 0;
const MIN_PAGE_WIDTH = 240;
const MAX_PAGE_WIDTH = 2000;
const MIN_PAGE_HEIGHT = 320;
const MAX_PAGE_HEIGHT = 4000;
const MIN_PAGE_MARGIN = 0;
const PREVIEW_HORIZONTAL_PADDING = 32;
const MIN_WORKSPACE_PANE_WIDTH = 280;
const DEFAULT_EDITOR_PANE_PERCENT = 45;
const DEFAULT_EDITOR_FONT_SIZE = 14;
const MIN_EDITOR_FONT_SIZE = 11;
const MAX_EDITOR_FONT_SIZE = 22;

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

function storedSource(): string {
  try {
    return window.localStorage.getItem(SOURCE_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function storedSourceWrap(): boolean {
  try {
    return window.localStorage.getItem(SOURCE_WRAP_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

function storedBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value !== "false";
  } catch {
    return fallback;
  }
}

function storedNumber(key: string, fallback: number, min: number, max: number): number {
  try {
    const value = Number(window.localStorage.getItem(key));
    return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
  } catch {
    return fallback;
  }
}

function initialLanguage(): Language {
  if (typeof window === "undefined") {
    return "en";
  }
  return storedLanguage() ?? systemLanguage();
}

function initialSource(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return storedSource();
}

function initialSourceWrap(): boolean {
  if (typeof window === "undefined") {
    return true;
  }
  return storedSourceWrap();
}

function initialEditorFontSize(): number {
  if (typeof window === "undefined") {
    return DEFAULT_EDITOR_FONT_SIZE;
  }
  return storedNumber(EDITOR_FONT_SIZE_STORAGE_KEY, DEFAULT_EDITOR_FONT_SIZE, MIN_EDITOR_FONT_SIZE, MAX_EDITOR_FONT_SIZE);
}

function initialEditorPanePercent(): number {
  if (typeof window === "undefined") {
    return DEFAULT_EDITOR_PANE_PERCENT;
  }
  return storedNumber(EDITOR_PANE_PERCENT_STORAGE_KEY, DEFAULT_EDITOR_PANE_PERCENT, 1, 99);
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

function audioExportSummary(language: Language, noteCount: number, seconds: number): string {
  const roundedSeconds = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  if (language === "zh") {
    return `${noteCount}${translate(language, noteCount === 1 ? "event" : "events")}，${roundedSeconds}s`;
  }
  return `${noteCount} ${translate(language, noteCount === 1 ? "event" : "events")}, ${roundedSeconds}s`;
}

function overwideScoreWarningMessage(warning: OverwideScoreLayoutWarning): string {
  if (warning.kind === "wrapped-source-line") {
    return warning.multiTrack
      ? `A simultaneous multi-track source line was automatically wrapped into ${warning.visualLineCount} visual lines because the current page content is too narrow (${warning.naturalWidth}px > ${warning.pageWidth}px). Matching source line breaks at measure boundaries can make voices easier to compare.`
      : `A source score line was automatically wrapped into ${warning.visualLineCount} visual lines because the current page content is too narrow (${warning.naturalWidth}px > ${warning.pageWidth}px). Try a wider page or insert source line breaks at measure boundaries.`;
  }
  return warning.multiTrack
    ? `A simultaneous multi-track measure or visual line is wider than the current page content (${warning.naturalWidth}px > ${warning.pageWidth}px). Matching source line breaks at measure boundaries can make voices easier to compare.`
    : `A dense measure or visual line is wider than the current page content (${warning.naturalWidth}px > ${warning.pageWidth}px). Try a wider page, less dense notation, or source line breaks at measure boundaries.`;
}

function pageLayoutWarningMessage(warning: PageLayoutWarning): string {
  return warning.kind === "small-usable-page-height"
    ? `Only ${warning.usableHeight}px of page height is usable after margins and footer space. Increase page height or reduce margins before exporting.`
    : `These page settings create ${warning.pageCount} pages. Increase page height or reduce margins if the export feels too fragmented.`;
}

export function App() {
  const [source, setSource] = useState(() => initialSource());
  const [sourceWrap, setSourceWrap] = useState(() => initialSourceWrap());
  const [editorFontSize, setEditorFontSize] = useState(() => initialEditorFontSize());
  const [showLineNumbers, setShowLineNumbers] = useState(() => storedBoolean(SHOW_LINE_NUMBERS_STORAGE_KEY, true));
  const [highlightCurrentLine, setHighlightCurrentLine] = useState(() => storedBoolean(HIGHLIGHT_CURRENT_LINE_STORAGE_KEY, true));
  const [highlightDiagnostics, setHighlightDiagnostics] = useState(() => storedBoolean(HIGHLIGHT_DIAGNOSTICS_STORAGE_KEY, true));
  const [language, setLanguage] = useState<Language>(() => initialLanguage());
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndices, setActiveNoteIndices] = useState<number[]>([]);
  const [pageWidthMode, setPageWidthMode] = useState<PageWidthMode>("panel");
  const [paperPreset, setPaperPreset] = useState<PaperSelection>("custom");
  const [pageOrientation, setPageOrientation] = useState<PageOrientation>("portrait");
  const [manualPageWidth, setManualPageWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [panelPageWidth, setPanelPageWidth] = useState(DEFAULT_PAGE_WIDTH);
  const [paginateOverride, setPaginateOverride] = useState<boolean | null>(null);
  const [pageHeight, setPageHeight] = useState(DEFAULT_PAGE_HEIGHT);
  const [pageMargin, setPageMargin] = useState(DEFAULT_PAGE_MARGIN);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [justifyMode, setJustifyMode] = useState<JustifyMode>("none");
  const [theme, setTheme] = useState<ThemeName>(() => initialTheme());
  const [scoreColor, setScoreColor] = useState(() => themeColors(initialTheme()).scoreColor);
  const [pageBackground, setPageBackground] = useState(() => themeColors(initialTheme()).pageBackground);
  const [program, setProgram] = useState(0);
  const [volume, setVolume] = useState(100);
  const [audioSampleRate, setAudioSampleRate] = useState(44100);
  const [pngScale, setPngScale] = useState(DEFAULT_PNG_SCALE);
  const [splitPages, setSplitPages] = useState(false);
  const [omitInitialRests, setOmitInitialRests] = useState(true);
  const [exportingAudio, setExportingAudio] = useState<"wav" | "mp3" | null>(null);
  const [audioExportDetails, setAudioExportDetails] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [pendingReplacementSource, setPendingReplacementSource] = useState<string | null>(null);
  const [confirmClearSource, setConfirmClearSource] = useState(false);
  const [editorPanePercent, setEditorPanePercent] = useState(() => initialEditorPanePercent());
  const playerRef = useRef<PreviewAudioPlayer | null>(null);
  const workspaceRef = useRef<HTMLElement | null>(null);
  const previewPanelRef = useRef<HTMLElement | null>(null);
  const lastValidParsedRef = useRef<Result<Document> | null>(null);
  const t = (key: TranslationKey, values?: Record<string, string | number>) => translate(language, key, values);
  const parsed = useMemo(() => parse(source), [source]);
  if (parsed.ok) {
    lastValidParsedRef.current = parsed;
  }
  const previewParsed = parsed.ok ? parsed : lastValidParsedRef.current;
  const previewIsStale = !parsed.ok && previewParsed?.ok === true;
  const contentPageWidth = useMemo(
    () => (previewParsed?.ok ? inferContentPageWidth(previewParsed.value, { minWidth: MIN_PAGE_WIDTH, maxWidth: MAX_PAGE_WIDTH }) : DEFAULT_PAGE_WIDTH),
    [previewParsed],
  );
  const customPageWidth = pageWidthMode === "panel" ? panelPageWidth : pageWidthMode === "content" ? contentPageWidth : manualPageWidth;
  const pageSize = resolvePageSize({
    paper: paperPreset === "custom" ? undefined : paperPreset,
    orientation: pageOrientation,
    pageWidth: paperPreset === "custom" ? customPageWidth : undefined,
    pageHeight: paperPreset === "custom" ? pageHeight : undefined,
  });
  const pageWidth = pageSize.pageWidth;
  const resolvedPageHeight = pageSize.pageHeight;
  const headerPaginate = previewParsed?.ok ? previewParsed.value.header.paginate : false;
  const effectivePaginate = paginateOverride ?? headerPaginate;
  const maxPageMargin = Math.max(MIN_PAGE_MARGIN, Math.floor((Math.min(pageWidth, effectivePaginate ? resolvedPageHeight : pageWidth) - 1) / 2));
  const pageContentWidth = Math.max(1, pageWidth - pageMargin * 2);
  const headerPageFooter = previewParsed?.ok ? previewParsed.value.header.footer : "";
  const headerPageNumbers = previewParsed?.ok ? previewParsed.value.header.numbering : false;
  const effectivePageNumbers = headerPageNumbers || (effectivePaginate && pageNumbers);
  const trackProgramOverrideCount = parsed.ok ? Object.keys(parsed.value.header.trackPrograms).length : 0;
  const layoutDiagnostics = useMemo<Diagnostic[]>(
    () =>
      parsed.ok
        ? analyzeScoreOverwidth(parsed.value, pageContentWidth).map((warning) => ({
            severity: "warning",
            message: overwideScoreWarningMessage(warning),
            range: warning.range,
          }))
        : [],
    [pageContentWidth, parsed],
  );
  const svg = useMemo(
    () =>
      previewParsed?.ok
        ? renderSvg(previewParsed.value, {
            pageWidth,
            paginate: effectivePaginate,
            pageHeight: resolvedPageHeight,
            pageMargin,
            pageFooter: headerPageFooter,
            pageNumbers: effectivePageNumbers,
            justifyMode,
            activeNoteIndices: parsed.ok ? activeNoteIndices : [],
            color: scoreColor,
            background: pageBackground,
          })
        : null,
    [
      activeNoteIndices,
      effectivePageNumbers,
      effectivePaginate,
      headerPageFooter,
      justifyMode,
      pageBackground,
      resolvedPageHeight,
      pageMargin,
      pageWidth,
      parsed.ok,
      previewParsed,
      scoreColor,
    ],
  );
  const svgPages = useMemo(
    () =>
      previewParsed?.ok
        ? renderSvgPages(previewParsed.value, {
            pageWidth,
            paginate: effectivePaginate,
            pageHeight: resolvedPageHeight,
            pageMargin,
            pageFooter: headerPageFooter,
            pageNumbers: effectivePageNumbers,
            justifyMode,
            activeNoteIndices: parsed.ok ? activeNoteIndices : [],
            color: scoreColor,
            background: pageBackground,
          })
        : null,
    [
      activeNoteIndices,
      effectivePageNumbers,
      effectivePaginate,
      headerPageFooter,
      justifyMode,
      pageBackground,
      resolvedPageHeight,
      pageMargin,
      pageWidth,
      parsed.ok,
      previewParsed,
      scoreColor,
    ],
  );
  const previewPageCount = useMemo(() => (svg ? Math.max(1, svg.match(/<g class="page" /g)?.length ?? 1) : 0), [svg]);
  const pngDimensions = useMemo(() => {
    const pngSvg = splitPages ? svgPages?.[0]?.svg : svg;
    return pngSvg ? pngPixelDimensions(pngSvg, pngScale) : { width: 0, height: 0 };
  }, [pngScale, splitPages, svg, svgPages]);
  const selectedPaperPreset = paperPreset === "custom" ? null : (PAPER_PRESET_LIST.find((preset) => preset.name === paperPreset) ?? null);
  const pageWidthModeLabel =
    selectedPaperPreset === null ? t(pageWidthModeLabels[pageWidthMode]) : `${selectedPaperPreset.label} ${t(pageOrientation)}`;
  const pageHeightWarningMessages = useMemo(
    () =>
      pageLayoutWarnings({
        paginate: effectivePaginate,
        pageHeight: resolvedPageHeight,
        pageMargin,
        pageFooter: headerPageFooter,
        pageNumbers: effectivePageNumbers,
        pageCount: previewPageCount,
      }).map(pageLayoutWarningMessage),
    [effectivePageNumbers, effectivePaginate, headerPageFooter, resolvedPageHeight, pageMargin, previewPageCount],
  );
  const pageHeightDiagnostics = parsed.ok
    ? pageHeightWarningMessages.map((message) => ({
        severity: "warning" as const,
        message,
      }))
    : [];
  const diagnostics = parsed.ok ? [...parsed.diagnostics, ...layoutDiagnostics, ...pageHeightDiagnostics] : parsed.diagnostics;

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-Hans" : "en";
  }, [language]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SOURCE_STORAGE_KEY, source);
    } catch {
      // Source persistence is optional.
    }
  }, [source]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SOURCE_WRAP_STORAGE_KEY, String(sourceWrap));
    } catch {
      // Editor preference persistence is optional.
    }
  }, [sourceWrap]);

  useEffect(() => {
    setPageMargin((current) => Math.min(current, maxPageMargin));
  }, [maxPageMargin]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_FONT_SIZE_STORAGE_KEY, String(editorFontSize));
    } catch {
      // Editor preference persistence is optional.
    }
  }, [editorFontSize]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_LINE_NUMBERS_STORAGE_KEY, String(showLineNumbers));
    } catch {
      // Editor preference persistence is optional.
    }
  }, [showLineNumbers]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIGHLIGHT_CURRENT_LINE_STORAGE_KEY, String(highlightCurrentLine));
    } catch {
      // Editor preference persistence is optional.
    }
  }, [highlightCurrentLine]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HIGHLIGHT_DIAGNOSTICS_STORAGE_KEY, String(highlightDiagnostics));
    } catch {
      // Editor preference persistence is optional.
    }
  }, [highlightDiagnostics]);

  useEffect(() => {
    try {
      window.localStorage.setItem(EDITOR_PANE_PERCENT_STORAGE_KEY, String(Math.round(editorPanePercent * 10) / 10));
    } catch {
      // Editor preference persistence is optional.
    }
  }, [editorPanePercent]);

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

  function updateWorkspaceSplit(clientX: number) {
    const element = workspaceRef.current;
    if (!element) {
      return;
    }

    const bounds = element.getBoundingClientRect();
    if (bounds.width <= 0) {
      return;
    }

    const minPercent = Math.min(50, (MIN_WORKSPACE_PANE_WIDTH / bounds.width) * 100);
    const rawPercent = ((clientX - bounds.left) / bounds.width) * 100;
    setEditorPanePercent(Math.min(100 - minPercent, Math.max(minPercent, rawPercent)));
  }

  function adjustWorkspaceSplit(delta: number) {
    const element = workspaceRef.current;
    const width = element?.getBoundingClientRect().width ?? 0;
    const minPercent = width > 0 ? Math.min(50, (MIN_WORKSPACE_PANE_WIDTH / width) * 100) : 0;
    setEditorPanePercent((current) => Math.min(100 - minPercent, Math.max(minPercent, current + delta)));
  }

  function startWorkspaceResize(event: PointerEvent<HTMLDivElement>) {
    if (window.matchMedia?.("(max-width: 980px)").matches) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    updateWorkspaceSplit(event.clientX);
  }

  function resizeWorkspace(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    updateWorkspaceSplit(event.clientX);
  }

  function stopWorkspaceResize(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function resizeWorkspaceWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      adjustWorkspaceSplit(-2);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      adjustWorkspaceSplit(2);
    } else if (event.key === "Home") {
      event.preventDefault();
      setEditorPanePercent(DEFAULT_EDITOR_PANE_PERCENT);
    }
  }

  async function exportSvg() {
    if (!parsed.ok || !svg) {
      return;
    }
    try {
      if (splitPages && svgPages) {
        for (const [index, page] of svgPages.entries()) {
          downloadBytes(await embedSvgDownloadFonts(page.svg), splitPageExportFilename(parsed.value.header.title, "svg", index + 1, svgPages.length), "image/svg+xml");
        }
        return;
      }
      downloadBytes(await embedSvgDownloadFonts(svg), exportFilename(parsed.value.header.title, "svg"), "image/svg+xml");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export SVG.");
    }
  }

  async function exportPng() {
    if (!parsed.ok || !svg) {
      return;
    }
    try {
      if (splitPages && svgPages) {
        for (const [index, page] of svgPages.entries()) {
          downloadBlob(await svgToPngBlob(page.svg, { scale: pngScale }), splitPageExportFilename(parsed.value.header.title, "png", index + 1, svgPages.length));
          await waitForNextFrame();
        }
        return;
      }
      downloadBlob(await svgToPngBlob(svg, { scale: pngScale }), exportFilename(parsed.value.header.title, "png"));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export PNG.");
    }
  }

  async function exportPdf() {
    if (!parsed.ok || !svgPages) {
      return;
    }
    try {
      const { svgPagesToPdfBuffer } = await import("./pdf-export.js");
      const buffer = await svgPagesToPdfBuffer(svgPages);
      downloadBytes(buffer, exportFilename(parsed.value.header.title, "pdf"), "application/pdf");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export PDF.");
    }
  }

  function exportMidi() {
    if (parsed.ok) {
      const midi = exportMidiBytes(parsed.value, program, { omitInitialRests });
      const buffer = midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength) as ArrayBuffer;
      downloadBytes(buffer, exportFilename(parsed.value.header.title, "mid"), "audio/midi");
    }
  }

  function describeAudioExport(): string {
    if (!parsed.ok) {
      return "";
    }
    const compiled = compileArrangement(parsed.value, program);
    const arrangement = omitInitialRests ? skipInitialArrangementRests(compiled) : compiled;
    const secondsPerWholeNote = (60 / arrangement.tempo) * arrangement.beatsPerWholeNote;
    const seconds = arrangementDuration(arrangement) * secondsPerWholeNote;
    return audioExportSummary(language, arrangementNoteCount(arrangement), seconds);
  }

  async function exportWav() {
    if (!parsed.ok || exportingAudio) {
      return;
    }
    setExportingAudio("wav");
    setAudioExportDetails(describeAudioExport());
    try {
      await waitForNextFrame();
      const { exportBrowserWavBytes } = await import("./audio-export.js");
      const wav = await exportBrowserWavBytes(parsed.value, {
        program,
        sampleRate: audioSampleRate,
        amplitude: Math.min(1, Math.max(0, volume / 100)),
        omitInitialRests,
      });
      const buffer = wav.buffer.slice(wav.byteOffset, wav.byteOffset + wav.byteLength) as ArrayBuffer;
      downloadBytes(buffer, exportFilename(parsed.value.header.title, "wav"), "audio/wav");
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
      const { exportBrowserMp3Bytes } = await import("./audio-export.js");
      const mp3 = await exportBrowserMp3Bytes(parsed.value, {
        program,
        sampleRate: audioSampleRate,
        amplitude: Math.min(1, Math.max(0, volume / 100)),
        omitInitialRests,
      });
      const buffer = mp3.buffer.slice(mp3.byteOffset, mp3.byteOffset + mp3.byteLength) as ArrayBuffer;
      downloadBytes(buffer, exportFilename(parsed.value.header.title, "mp3"), "audio/mpeg");
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
    const compiled = compileArrangement(parsed.value, program);
    const arrangement = startNoteIndex === 0 && omitInitialRests ? skipInitialArrangementRests(compiled) : compiled;
    const playbackArrangement = startNoteIndex === 0 ? arrangement : trimArrangementAtNote(arrangement, startNoteIndex);
    setIsPlaying(true);
    await player.play(
      playbackArrangement,
      () => {
        setIsPlaying(false);
        setActiveNoteIndices([]);
      },
      setActiveNoteIndices,
      volume / 100,
    );
  }

  async function auditionProgram() {
    const result = parse(program >= 128 ? DRUM_AUDITION_SOURCE : MELODIC_AUDITION_SOURCE);
    if (!result.ok) {
      return;
    }
    const player = playerRef.current ?? new PreviewAudioPlayer();
    playerRef.current = player;
    setActiveNoteIndices([]);
    setIsPlaying(true);
    await player.play(
      compileArrangement(result.value, program),
      () => {
        setIsPlaying(false);
        setActiveNoteIndices([]);
      },
      undefined,
      volume / 100,
    );
  }

  function stopPlayback() {
    playerRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndices([]);
  }

  function stop() {
    setShowExamples(false);
    stopPlayback();
  }

  function loadSource(nextSource: string) {
    stopPlayback();
    setSource(nextSource);
    setPendingReplacementSource(null);
  }

  function requestSourceReplacement(nextSource: string) {
    if (source.trim().length === 0) {
      loadSource(nextSource);
      return;
    }
    setPendingReplacementSource(nextSource);
  }

  function requestExampleSource(nextSource: string) {
    requestSourceReplacement(nextSource);
  }

  async function openSourceFile(file: File) {
    try {
      const text = await file.text();
      setShowExamples(false);
      requestSourceReplacement(text);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to open score file.");
    }
  }

  function saveSourceFile() {
    const title = parsed.ok ? parsed.value.header.title : "";
    downloadBytes(source, exportFilename(title, "jpu"), "text/plain;charset=utf-8");
  }

  function updateSource(nextSource: string) {
    playerRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndices([]);
    setSource(nextSource);
  }
  function clearSource() {
    stopPlayback();
    setSource("");
    setConfirmClearSource(false);
    try {
      window.localStorage.removeItem(SOURCE_STORAGE_KEY);
    } catch {
      // Source persistence is optional.
    }
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
        <div className="brand-lockup">
          <img className="brand-mark" src="/favicon.svg" alt="" />
          <h1>Modern Jianpu Markup</h1>
        </div>
        <Toolbar
          language={language}
          theme={theme}
          isPlaying={isPlaying}
          canPlay={parsed.ok}
          canExportScore={parsed.ok}
          canExportImage={parsed.ok && svg !== null}
          exportingAudio={exportingAudio}
          audioExportDetails={audioExportDetails}
          t={t}
          onToggleLanguage={toggleLanguage}
          onToggleTheme={toggleTheme}
          onToggleSettings={() => setShowSettings((visible) => !visible)}
          onToggleExamples={() => setShowExamples((visible) => !visible)}
          onOpenFile={(file) => void openSourceFile(file)}
          onSaveSource={saveSourceFile}
          onPlay={() => void play()}
          onStop={stop}
          onExportSvg={() => void exportSvg()}
          onExportPng={() => void exportPng()}
          onExportPdf={() => void exportPdf()}
          onExportMidi={exportMidi}
          onExportWav={() => void exportWav()}
          onExportMp3={() => void exportMp3()}
        />
      </header>

      {showSettings && (
        <SettingsPanel
          t={t}
          pageWidthMode={pageWidthMode}
          paperPreset={paperPreset}
          pageOrientation={pageOrientation}
          panelPageWidth={panelPageWidth}
          contentPageWidth={contentPageWidth}
          manualPageWidth={manualPageWidth}
          minPageWidth={MIN_PAGE_WIDTH}
          maxPageWidth={MAX_PAGE_WIDTH}
          paginate={effectivePaginate}
          pageHeight={resolvedPageHeight}
          minPageHeight={MIN_PAGE_HEIGHT}
          maxPageHeight={MAX_PAGE_HEIGHT}
          pageMargin={pageMargin}
          minPageMargin={MIN_PAGE_MARGIN}
          maxPageMargin={maxPageMargin}
          pageNumbers={pageNumbers}
          pageWarnings={pageHeightWarningMessages}
          scoreColor={scoreColor}
          pageBackground={pageBackground}
          justifyMode={justifyMode}
          program={program}
          trackProgramOverrideCount={trackProgramOverrideCount}
          volume={volume}
          audioSampleRate={audioSampleRate}
          pngScale={pngScale}
          pngPixelWidth={pngDimensions.width}
          pngPixelHeight={pngDimensions.height}
          splitPages={splitPages}
          omitInitialRests={omitInitialRests}
          sourceWrap={sourceWrap}
          editorFontSize={editorFontSize}
          minEditorFontSize={MIN_EDITOR_FONT_SIZE}
          maxEditorFontSize={MAX_EDITOR_FONT_SIZE}
          showLineNumbers={showLineNumbers}
          highlightCurrentLine={highlightCurrentLine}
          highlightDiagnostics={highlightDiagnostics}
          onClose={() => setShowSettings(false)}
          onPageWidthModeChange={setPageWidthMode}
          onPaperPresetChange={setPaperPreset}
          onPageOrientationChange={setPageOrientation}
          onManualPageWidthChange={setManualPageWidth}
          onPaginateChange={setPaginateOverride}
          onPageHeightChange={setPageHeight}
          onPageMarginChange={setPageMargin}
          onPageNumbersChange={setPageNumbers}
          onScoreColorChange={setScoreColor}
          onPageBackgroundChange={setPageBackground}
          onJustifyModeChange={setJustifyMode}
          onProgramChange={setProgram}
          onVolumeChange={setVolume}
          onAudioSampleRateChange={setAudioSampleRate}
          onPngScaleChange={setPngScale}
          onSplitPagesChange={setSplitPages}
          onOmitInitialRestsChange={setOmitInitialRests}
          onSourceWrapChange={setSourceWrap}
          onEditorFontSizeChange={setEditorFontSize}
          onShowLineNumbersChange={setShowLineNumbers}
          onHighlightCurrentLineChange={setHighlightCurrentLine}
          onHighlightDiagnosticsChange={setHighlightDiagnostics}
          onAuditionProgram={() => void auditionProgram()}
        />
      )}
      {showExamples && (
        <ExamplesPanel language={language} t={t} onClose={() => setShowExamples(false)} onSelectExample={requestExampleSource} />
      )}
      {pendingReplacementSource !== null && (
        <div className="score-warning-overlay" role="presentation">
          <section className="score-warning-dialog" role="dialog" aria-modal="true" aria-labelledby="score-warning-title">
            <h2 id="score-warning-title">{t("overwriteScoreTitle")}</h2>
            <p>{t("overwriteScoreMessage")}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingReplacementSource(null)}>
                {t("cancel")}
              </button>
              <button type="button" className="danger-action" onClick={() => loadSource(pendingReplacementSource)}>
                {t("overwriteScoreConfirm")}
              </button>
            </div>
          </section>
        </div>
      )}

      {confirmClearSource && (
        <div className="score-warning-overlay" role="presentation">
          <section className="score-warning-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-source-title">
            <h2 id="clear-source-title">{t("clearScoreTitle")}</h2>
            <p>{t("clearScoreMessage")}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setConfirmClearSource(false)}>
                {t("cancel")}
              </button>
              <button type="button" className="danger-action" onClick={clearSource}>
                {t("clearScoreConfirm")}
              </button>
            </div>
          </section>
        </div>
      )}

      <section
        className="workspace"
        ref={workspaceRef}
        style={{ "--editor-pane-percent": `${editorPanePercent}%` } as CSSProperties}
      >
        <SourceEditor
          source={source}
          diagnostics={diagnostics}
          ok={parsed.ok}
          summary={diagnosticSummary(language, parsed.ok, diagnostics)}
          sourceWrap={sourceWrap}
          editorFontSize={editorFontSize}
          showLineNumbers={showLineNumbers}
          highlightCurrentLine={highlightCurrentLine}
          highlightDiagnostics={highlightDiagnostics}
          t={t}
          onSourceChange={updateSource}
          onClearRequest={() => setConfirmClearSource(true)}
          onFocusEditor={() => setShowExamples(false)}
        />
        <div
          className="workspace-resizer"
          role="separator"
          aria-label="Resize editor and preview panes"
          aria-orientation="vertical"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(editorPanePercent)}
          tabIndex={0}
          onPointerDown={startWorkspaceResize}
          onPointerMove={resizeWorkspace}
          onPointerUp={stopWorkspaceResize}
          onPointerCancel={stopWorkspaceResize}
          onKeyDown={resizeWorkspaceWithKeyboard}
        />

        <PreviewPanel
          panelRef={previewPanelRef}
          previewDocument={previewParsed?.ok ? previewParsed.value : null}
          pageWidth={pageWidth}
          pageWidthModeLabel={pageWidthModeLabel}
          pageCount={previewPageCount}
          svg={svg}
          stale={previewIsStale}
          t={t}
          onClickPreview={playFromPreview}
        />
      </section>
    </main>
  );
}
