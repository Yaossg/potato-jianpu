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
const DEFAULT_PAGE_WIDTH = 1000;
const MIN_PAGE_WIDTH = 240;
const MAX_PAGE_WIDTH = 2000;
const PREVIEW_HORIZONTAL_PADDING = 32;

type ThemeName = "light" | "dark";
type PageWidthMode = "panel" | "content" | "manual";
type JustifyMode = "none" | "except-last" | "all";

function themeColors(theme: ThemeName) {
  return theme === "light" ? LIGHT_THEME : DARK_THEME;
}

function isThemeName(value: string | null): value is ThemeName {
  return value === "light" || value === "dark";
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

function initialTheme(): ThemeName {
  if (typeof window === "undefined") {
    return "light";
  }
  return storedTheme() ?? systemTheme();
}

function toPageWidthMode(value: string): PageWidthMode {
  return value === "content" || value === "manual" ? value : "panel";
}

function toJustifyMode(value: string): JustifyMode {
  return value === "except-last" || value === "all" ? value : "none";
}

function openGrammarRailroad() {
  window.open("grammar.html", "_blank", "noopener,noreferrer");
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

function diagnosticSummary(ok: boolean, diagnostics: Array<{ severity: "error" | "warning" }>): string {
  const errors = diagnostics.filter((diagnostic) => diagnostic.severity === "error").length;
  const warnings = diagnostics.filter((diagnostic) => diagnostic.severity === "warning").length;
  if (!ok) {
    return errors === 1 ? "1 error" : `${errors} errors`;
  }
  if (warnings > 0) {
    return warnings === 1 ? "Valid, 1 warning" : `Valid, ${warnings} warnings`;
  }
  return "Valid";
}

function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function audioExportSummary(noteCount: number, seconds: number): string {
  const roundedSeconds = seconds >= 10 ? Math.round(seconds) : Math.round(seconds * 10) / 10;
  return `${noteCount} event(s), ${roundedSeconds}s`;
}

export function App() {
  const [source, setSource] = useState("");
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
    return audioExportSummary(melody.notes.length, seconds);
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
          <p>Browser preview for the parser, SVG renderer, and audio exporters.</p>
        </div>
        <div className="actions">
          <button type="button" onClick={toggleTheme}>
            Theme: {theme === "light" ? "Light" : "Dark"}
          </button>
          <button type="button" onClick={openGrammarRailroad}>
            Grammar
          </button>
          <button type="button" onClick={() => setShowSettings((visible) => !visible)}>
            Settings
          </button>
          <button type="button" onClick={() => setShowExamples((visible) => !visible)}>
            Examples
          </button>
          {isPlaying ? (
            <button type="button" onClick={stop}>
              Stop
            </button>
          ) : (
            <button type="button" onClick={() => void play()} disabled={!parsed.ok}>
              Play
            </button>
          )}
          <details className="export-menu">
            <summary>Export</summary>
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
                {exportingAudio === "wav" ? "Exporting WAV..." : "WAV"}
              </button>
              <button type="button" onClick={() => void exportMp3()} disabled={!parsed.ok || exportingAudio !== null}>
                {exportingAudio === "mp3" ? "Exporting MP3..." : "MP3"}
              </button>
              {exportingAudio && <p className="export-status">{audioExportDetails ? `Rendering locally: ${audioExportDetails}` : "Rendering locally..."}</p>}
            </div>
          </details>
        </div>
      </header>

      {showSettings && (
        <section className="settings-panel">
          <div className="panel-title">
            <h2>Settings</h2>
            <button type="button" onClick={() => setShowSettings(false)}>
              Close
            </button>
          </div>
          <div className="settings-sections">
            <section className="settings-section">
              <h3>Page Settings</h3>
              <div className="settings-grid">
                <label className="select-control">
                  Width mode
                  <select value={pageWidthMode} onChange={(event) => setPageWidthMode(toPageWidthMode(event.target.value))}>
                    <option value="panel">Panel</option>
                    <option value="content">Content</option>
                    <option value="manual">Manual</option>
                  </select>
                </label>
                <label className="number-control">
                  Width
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
                  Color
                  <input type="color" value={scoreColor} onChange={(event) => setScoreColor(event.target.value)} />
                </label>
                <label className="color-control">
                  Page
                  <input type="color" value={pageBackground} onChange={(event) => setPageBackground(event.target.value)} />
                </label>
                <label className="select-control">
                  Justify
                  <select value={justifyMode} onChange={(event) => setJustifyMode(toJustifyMode(event.target.value))}>
                    <option value="none">None</option>
                    <option value="except-last">Except last line</option>
                    <option value="all">All lines</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="settings-section">
              <h3>Sound Settings</h3>
              <div className="settings-grid">
                <label className="select-control">
                  Program
                  <select
                    value={program}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value >= 0 && value <= 220) {
                        setProgram(value);
                      }
                    }}
                  >
                    <optgroup label="General MIDI">
                      {GM_PROGRAMS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Drums">
                      {DRUM_PROGRAMS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                </label>
                <label className="range-control">
                  Volume
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
                  Audio sample rate
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
                  Omit initial rests
                </label>
                <button type="button" onClick={() => void auditionProgram()}>
                  Audition
                </button>
              </div>
            </section>
          </div>
        </section>
      )}

      {showExamples && (
        <section className="examples-panel">
          <div className="panel-title">
            <h2>Examples</h2>
            <button type="button" onClick={() => setShowExamples(false)}>
              Close
            </button>
          </div>
          <div className="examples-grid">
            {examples.map((example) => (
              <button
                key={example.name}
                type="button"
                onClick={() => loadSource(example.source)}
              >
                {example.name}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="workspace">
        <section className="editor-panel">
          <div className="panel-title">
            <h2>Source</h2>
            <span className={parsed.ok ? (parsed.diagnostics.length > 0 ? "status-warning" : "status-ok") : "status-error"}>
              {diagnosticSummary(parsed.ok, parsed.diagnostics)}
            </span>
          </div>
          <textarea
            value={source}
            onChange={(event) => updateSource(event.target.value)}
            onFocus={() => setShowExamples(false)}
            placeholder="Enter your Jianpu here..."
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
            <h2>Preview</h2>
            <span>{parsed.ok ? `${parsed.value.score.length} source line(s), ${pageWidth}px ${pageWidthMode}` : "No preview"}</span>
          </div>
          <div className="preview-scroll" onClick={playFromPreview}>
            {svg ? <div className="score-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <p>Fix parse errors to preview.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
