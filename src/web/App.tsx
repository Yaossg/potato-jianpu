import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { Document, Result } from "../core/model.js";
import {
  arrangementDuration,
  arrangementNoteCount,
  compileArrangement,
  exportMidiBytes,
  parse,
  skipInitialArrangementRests,
  trimArrangementAtNote,
} from "../index.js";
import { inferContentPageWidth, renderSvg } from "../renderer/index.js";
import { exportBrowserMp3Bytes, exportBrowserWavBytes } from "./audio-export.js";
import { PreviewAudioPlayer } from "./audio.js";
import { waitForNextFrame } from "./browser-utils.js";
import { downloadBlob, downloadBytes, svgToPngBlob } from "./downloads.js";
import { ExamplesPanel } from "./ExamplesPanel.js";
import { exportFilename } from "./export-filename.js";
import { isLanguage, pageWidthModeLabels, translate } from "./i18n.js";
import { PreviewPanel } from "./PreviewPanel.js";
import { SettingsPanel } from "./SettingsPanel.js";
import { SourceEditor } from "./SourceEditor.js";
import { Toolbar } from "./Toolbar.js";
import { initialTheme, THEME_STORAGE_KEY, themeColors } from "./theme.js";
import type { JustifyMode, Language, PageWidthMode, TranslationKey } from "./i18n.js";
import type { ThemeName } from "./theme.js";

const MELODIC_AUDITION_SOURCE = "1 2 3 4 5 6 7 1'";
const DRUM_AUDITION_SOURCE = "X X X X";
const LANGUAGE_STORAGE_KEY = "modern-jianpu-markup-language";
const SOURCE_STORAGE_KEY = "modern-jianpu-markup-source";
const DEFAULT_PAGE_WIDTH = 1000;
const MIN_PAGE_WIDTH = 240;
const MAX_PAGE_WIDTH = 2000;
const PREVIEW_HORIZONTAL_PADDING = 32;
const MIN_WORKSPACE_PANE_WIDTH = 280;
const DEFAULT_EDITOR_PANE_PERCENT = 45;

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

export function App() {
  const [source, setSource] = useState(() => initialSource());
  const [language, setLanguage] = useState<Language>(() => initialLanguage());
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndices, setActiveNoteIndices] = useState<number[]>([]);
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
  const [pendingExampleSource, setPendingExampleSource] = useState<string | null>(null);
  const [confirmClearSource, setConfirmClearSource] = useState(false);
  const [editorPanePercent, setEditorPanePercent] = useState(DEFAULT_EDITOR_PANE_PERCENT);
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
  const pageWidth = pageWidthMode === "panel" ? panelPageWidth : pageWidthMode === "content" ? contentPageWidth : manualPageWidth;
  const svg = useMemo(
    () =>
      previewParsed?.ok
        ? renderSvg(previewParsed.value, {
            pageWidth,
            justifyMode,
            activeNoteIndices: parsed.ok ? activeNoteIndices : [],
            color: scoreColor,
            background: pageBackground,
          })
        : null,
    [activeNoteIndices, justifyMode, pageBackground, pageWidth, parsed.ok, previewParsed, scoreColor],
  );

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

  function exportSvg() {
    if (parsed.ok && svg) {
      downloadBytes(svg, exportFilename(parsed.value.header.title, "svg"), "image/svg+xml");
    }
  }

  async function exportPng() {
    if (!parsed.ok || !svg) {
      return;
    }
    try {
      downloadBlob(await svgToPngBlob(svg), exportFilename(parsed.value.header.title, "png"));
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Failed to export PNG.");
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
      program,
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
    setPendingExampleSource(null);
  }

  function requestExampleSource(nextSource: string) {
    if (source.trim().length === 0) {
      loadSource(nextSource);
      return;
    }
    setPendingExampleSource(nextSource);
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
        <div>
          <h1>Modern Jianpu Markup</h1>
          <p>{t("tagline")}</p>
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
          onPlay={() => void play()}
          onStop={stop}
          onExportSvg={exportSvg}
          onExportPng={() => void exportPng()}
          onExportMidi={exportMidi}
          onExportWav={() => void exportWav()}
          onExportMp3={() => void exportMp3()}
        />
      </header>

      {showSettings && (
        <SettingsPanel
          t={t}
          pageWidthMode={pageWidthMode}
          panelPageWidth={panelPageWidth}
          contentPageWidth={contentPageWidth}
          manualPageWidth={manualPageWidth}
          minPageWidth={MIN_PAGE_WIDTH}
          maxPageWidth={MAX_PAGE_WIDTH}
          scoreColor={scoreColor}
          pageBackground={pageBackground}
          justifyMode={justifyMode}
          program={program}
          volume={volume}
          audioSampleRate={audioSampleRate}
          omitInitialRests={omitInitialRests}
          onClose={() => setShowSettings(false)}
          onPageWidthModeChange={setPageWidthMode}
          onManualPageWidthChange={setManualPageWidth}
          onScoreColorChange={setScoreColor}
          onPageBackgroundChange={setPageBackground}
          onJustifyModeChange={setJustifyMode}
          onProgramChange={setProgram}
          onVolumeChange={setVolume}
          onAudioSampleRateChange={setAudioSampleRate}
          onOmitInitialRestsChange={setOmitInitialRests}
          onAuditionProgram={() => void auditionProgram()}
        />
      )}
      {showExamples && (
        <ExamplesPanel language={language} t={t} onClose={() => setShowExamples(false)} onSelectExample={requestExampleSource} />
      )}
      {pendingExampleSource !== null && (
        <div className="score-warning-overlay" role="presentation">
          <section className="score-warning-dialog" role="dialog" aria-modal="true" aria-labelledby="score-warning-title">
            <h2 id="score-warning-title">{t("overwriteScoreTitle")}</h2>
            <p>{t("overwriteScoreMessage")}</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setPendingExampleSource(null)}>
                {t("cancel")}
              </button>
              <button type="button" className="danger-action" onClick={() => loadSource(pendingExampleSource)}>
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
          diagnostics={parsed.diagnostics}
          ok={parsed.ok}
          summary={diagnosticSummary(language, parsed.ok, parsed.diagnostics)}
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
          pageWidthModeLabel={t(pageWidthModeLabels[pageWidthMode])}
          svg={svg}
          stale={previewIsStale}
          t={t}
          onClickPreview={playFromPreview}
        />
      </section>
    </main>
  );
}
