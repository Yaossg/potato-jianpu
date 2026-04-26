import { useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { compileMelody, DRUM_PROGRAMS, exportMidiBytes, GM_PROGRAMS, parse, skipInitialRests } from "../index.js";
import { renderSvg } from "../renderer/index.js";
import { PreviewAudioPlayer } from "./audio.js";
import scale from "../../examples/scale.jp?raw";
import twinkle from "../../examples/twinkle.jp?raw";
import odeToJoy from "../../examples/ode-to-joy.jp?raw";
import compound from "../../examples/compound-6-8.jp?raw";
import accidentals from "../../examples/accidentals-and-ties.jp?raw";
import chords from "../../examples/chords.jp?raw";
import drums from "../../examples/drums.jp?raw";
import jingleBells from "../../examples/jingle-bells.jp?raw";
import happyBirthday from "../../examples/happy-birthday.jp?raw";
import dearLittleWish from "../../examples/dear-little-wish.jp?raw";
import burningField from "../../examples/burning-field.jp?raw";
import blockyHeroes from "../../examples/blocky-heroes.jp?raw";
import shining from "../../examples/shining-from-the-underground.jp?raw";
import grammarReference from "../../docs/GRAMMAR.md?raw";

const examples = [
  { name: "Scale", source: scale },
  { name: "Twinkle", source: twinkle },
  { name: "Ode to Joy", source: odeToJoy },
  { name: "6/8 Study", source: compound },
  { name: "Accidentals", source: accidentals },
  { name: "Chords", source: chords },
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
const THEME_STORAGE_KEY = "modern-jianpu-reloaded-theme";

type ThemeName = "light" | "dark";

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

function downloadBytes(data: BlobPart, filename: string, type: string) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

export function App() {
  const [source, setSource] = useState(twinkle);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNoteIndex, setActiveNoteIndex] = useState<number | null>(null);
  const [pageWidth, setPageWidth] = useState(1000);
  const [theme, setTheme] = useState<ThemeName>(() => initialTheme());
  const [scoreColor, setScoreColor] = useState(() => themeColors(initialTheme()).scoreColor);
  const [pageBackground, setPageBackground] = useState(() => themeColors(initialTheme()).pageBackground);
  const [program, setProgram] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [omitInitialRests, setOmitInitialRests] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [showGrammar, setShowGrammar] = useState(false);
  const playerRef = useRef<PreviewAudioPlayer | null>(null);
  const parsed = useMemo(() => parse(source), [source]);
  const svg = useMemo(
    () =>
      parsed.ok
        ? renderSvg(parsed.value, {
            pageWidth,
            activeNoteIndex: activeNoteIndex ?? undefined,
            color: scoreColor,
            background: pageBackground,
          })
        : null,
    [activeNoteIndex, pageBackground, pageWidth, parsed, scoreColor],
  );

  function exportSvg() {
    if (svg) {
      downloadBytes(svg, "jianpu-score.svg", "image/svg+xml");
    }
  }

  function exportMidi() {
    if (parsed.ok) {
      const midi = exportMidiBytes(parsed.value, program, { omitInitialRests });
      const buffer = midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength) as ArrayBuffer;
      downloadBytes(buffer, "jianpu-score.mid", "audio/midi");
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
      volume,
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
      volume,
    );
  }

  function stop() {
    playerRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
  }

  function loadSource(nextSource: string) {
    stop();
    setSource(nextSource);
    setShowExamples(false);
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
          <h1>Modern Jianpu Reloaded</h1>
          <p>Browser preview for the rewritten parser, SVG renderer, and MIDI exporter.</p>
        </div>
        <div className="actions">
          <button type="button" onClick={toggleTheme}>
            Theme: {theme === "light" ? "Light" : "Dark"}
          </button>
          <button type="button" onClick={() => setShowGrammar((visible) => !visible)}>
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
          <button type="button" onClick={exportSvg} disabled={!svg}>
            Export SVG
          </button>
          <button type="button" onClick={exportMidi} disabled={!parsed.ok}>
            Export MIDI
          </button>
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
          <div className="settings-grid">
            <label className="number-control">
              Width
              <input
                type="number"
                min={240}
                max={2000}
                step={20}
                value={pageWidth}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value > 0) {
                    setPageWidth(value);
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
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => setVolume(Number(event.target.value))}
              />
              <span>{Math.round(volume * 100)}%</span>
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

      {showGrammar && (
        <section className="grammar-panel">
          <div className="panel-title">
            <h2>Grammar</h2>
            <button type="button" onClick={() => setShowGrammar(false)}>
              Close
            </button>
          </div>
          <pre>{grammarReference}</pre>
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
            onChange={(event) => setSource(event.target.value)}
            onFocus={() => setShowExamples(false)}
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

        <section className="preview-panel">
          <div className="panel-title">
            <h2>Preview</h2>
            <span>{parsed.ok ? `${parsed.value.score.length} source line(s), ${pageWidth}px` : "No preview"}</span>
          </div>
          <div className="preview-scroll" onClick={playFromPreview}>
            {svg ? <div className="score-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <p>Fix parse errors to preview.</p>}
          </div>
        </section>
      </section>
    </main>
  );
}
