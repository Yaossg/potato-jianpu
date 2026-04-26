import { useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { compileMelody, exportMidiBytes, parse } from "../index.js";
import { renderSvg } from "../renderer/index.js";
import { PreviewAudioPlayer } from "./audio.js";
import scale from "../../examples/scale.jp?raw";
import twinkle from "../../examples/twinkle.jp?raw";
import odeToJoy from "../../examples/ode-to-joy.jp?raw";
import compound from "../../examples/compound-6-8.jp?raw";
import accidentals from "../../examples/accidentals-and-ties.jp?raw";
import chords from "../../examples/chords.jp?raw";
import drums from "../../examples/drums.jp?raw";

const examples = [
  { name: "Scale", source: scale },
  { name: "Twinkle", source: twinkle },
  { name: "Ode to Joy", source: odeToJoy },
  { name: "6/8 Study", source: compound },
  { name: "Accidentals", source: accidentals },
  { name: "Chords", source: chords },
  { name: "Drums", source: drums },
];

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
  const [scoreColor, setScoreColor] = useState("#111827");
  const [pageBackground, setPageBackground] = useState("#ffffff");
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
      downloadBytes(svg, "score.svg", "image/svg+xml");
    }
  }

  function exportMidi() {
    if (parsed.ok) {
      const midi = exportMidiBytes(parsed.value);
      const buffer = midi.buffer.slice(midi.byteOffset, midi.byteOffset + midi.byteLength) as ArrayBuffer;
      downloadBytes(buffer, "score.mid", "audio/midi");
    }
  }

  async function play(startNoteIndex = 0) {
    if (!parsed.ok) {
      return;
    }
    const player = playerRef.current ?? new PreviewAudioPlayer();
    playerRef.current = player;
    setIsPlaying(true);
    await player.play(
      compileMelody(parsed.value),
      () => {
        setIsPlaying(false);
        setActiveNoteIndex(null);
      },
      setActiveNoteIndex,
      startNoteIndex,
    );
  }

  function stop() {
    playerRef.current?.stop();
    setIsPlaying(false);
    setActiveNoteIndex(null);
  }

  function playFromPreview(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>("[data-note-index]") : null;
    const noteIndex = Number(target?.dataset.noteIndex);
    if (Number.isInteger(noteIndex)) {
      void play(noteIndex);
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Modern Jianpu Reloaded</h1>
          <p>Browser preview for the rewritten parser, SVG renderer, and MIDI exporter.</p>
        </div>
        <div className="actions">
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

      <section className="workspace">
        <aside className="examples">
          <h2>Examples</h2>
          {examples.map((example) => (
            <button key={example.name} type="button" onClick={() => setSource(example.source)}>
              {example.name}
            </button>
          ))}
        </aside>

        <section className="editor-panel">
          <div className="panel-title">
            <h2>Source</h2>
            <span className={parsed.ok ? (parsed.diagnostics.length > 0 ? "status-warning" : "status-ok") : "status-error"}>
              {diagnosticSummary(parsed.ok, parsed.diagnostics)}
            </span>
          </div>
          <textarea value={source} onChange={(event) => setSource(event.target.value)} spellCheck={false} />
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
