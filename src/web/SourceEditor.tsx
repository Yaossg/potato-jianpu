import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, UIEvent } from "react";
import type { Diagnostic } from "../core/model.js";
import { diagnosticHighlightParts, sourceLineAtOffset, sourceLineNumbers, sourceLines } from "./diagnostics.js";
import type { TranslationKey } from "./i18n.js";

interface SourceEditorProps {
  source: string;
  diagnostics: Diagnostic[];
  ok: boolean;
  summary: string;
  sourceWrap: boolean;
  editorFontSize: number;
  showLineNumbers: boolean;
  highlightCurrentLine: boolean;
  highlightDiagnostics: boolean;
  t: (key: TranslationKey) => string;
  onSourceChange: (source: string) => void;
  onClearRequest: () => void;
  onFocusEditor: () => void;
}

interface LineDiagnosticSummary {
  severity: Diagnostic["severity"];
  tooltip: string;
  diagnostic: Diagnostic;
}

function lineDiagnosticSummaries(diagnostics: Diagnostic[]): Map<number, LineDiagnosticSummary> {
  const summaries = new Map<number, LineDiagnosticSummary>();

  for (const diagnostic of diagnostics) {
    if (!diagnostic.range) {
      continue;
    }

    const line = diagnostic.range.start.line;
    const current = summaries.get(line);
    if (!current) {
      summaries.set(line, {
        severity: diagnostic.severity,
        tooltip: `${line}:${diagnostic.range.start.column} ${diagnostic.message}`,
        diagnostic,
      });
      continue;
    }

    current.tooltip = `${current.tooltip}\n${line}:${diagnostic.range.start.column} ${diagnostic.message}`;
    if (current.severity !== "error" && diagnostic.severity === "error") {
      current.severity = diagnostic.severity;
      current.diagnostic = diagnostic;
    }
  }

  return summaries;
}

export function SourceEditor({
  source,
  diagnostics,
  ok,
  summary,
  sourceWrap,
  editorFontSize,
  showLineNumbers,
  highlightCurrentLine,
  highlightDiagnostics,
  t,
  onSourceChange,
  onClearRequest,
  onFocusEditor,
}: SourceEditorProps) {
  const [currentEditorLine, setCurrentEditorLine] = useState(1);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const editorCurrentLineRef = useRef<HTMLPreElement | null>(null);
  const editorCurrentLineSpansRef = useRef<Array<HTMLSpanElement | null>>([]);
  const editorHighlightRef = useRef<HTMLPreElement | null>(null);
  const editorLineNumbersRef = useRef<HTMLDivElement | null>(null);
  const [lineHeights, setLineHeights] = useState<number[]>([]);
  const diagnosticHighlights = useMemo(() => diagnosticHighlightParts(source, highlightDiagnostics ? diagnostics : []), [diagnostics, highlightDiagnostics, source]);
  const editorLines = useMemo(() => sourceLines(source), [source]);
  const lineNumbers = useMemo(() => sourceLineNumbers(source), [source]);
  const diagnosticsByLine = useMemo(() => lineDiagnosticSummaries(diagnostics), [diagnostics]);

  useLayoutEffect(() => {
    function updateLineHeights() {
      setLineHeights(editorCurrentLineSpansRef.current.map((line) => line?.getBoundingClientRect().height ?? 0));
    }

    updateLineHeights();
    const layer = editorCurrentLineRef.current;
    if (!layer || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(updateLineHeights);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [editorLines, sourceWrap, editorFontSize, showLineNumbers]);

  function updateSource(nextSource: string, selectionStart: number) {
    setCurrentEditorLine(sourceLineAtOffset(nextSource, selectionStart));
    onSourceChange(nextSource);
  }

  function updateCurrentEditorLine(selectionStart = editorRef.current?.selectionStart ?? 0) {
    setCurrentEditorLine(sourceLineAtOffset(source, selectionStart));
  }

  function syncEditorLayers(editor: HTMLTextAreaElement) {
    const highlight = editorHighlightRef.current;
    if (!highlight) {
      return;
    }
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
    if (editorCurrentLineRef.current) {
      editorCurrentLineRef.current.scrollTop = editor.scrollTop;
      editorCurrentLineRef.current.scrollLeft = editor.scrollLeft;
    }
    if (editorLineNumbersRef.current) {
      editorLineNumbersRef.current.scrollTop = editor.scrollTop;
    }
  }

  function syncEditorHighlightScroll(event: UIEvent<HTMLTextAreaElement>) {
    syncEditorLayers(event.currentTarget);
  }

  function selectDiagnosticRange(diagnostic: Diagnostic) {
    if (!diagnostic.range) {
      return;
    }
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    const start = Math.min(source.length, Math.max(0, diagnostic.range.start.offset));
    const end = Math.min(source.length, Math.max(start + 1, diagnostic.range.end.offset));
    editor.focus();
    editor.setSelectionRange(start, end);
    setCurrentEditorLine(diagnostic.range.start.line);
    window.requestAnimationFrame(() => syncEditorLayers(editor));
  }

  return (
    <section className="editor-panel">
      <div className="panel-title">
        <h2>{t("source")}</h2>
        <div className="panel-title-actions">
          <span className={ok ? (diagnostics.length > 0 ? "status-warning" : "status-ok") : "status-error"}>{summary}</span>
          <button type="button" onClick={onClearRequest} disabled={source.length === 0}>
            {t("clear")}
          </button>
        </div>
      </div>
      <div
        className={`editor-field ${sourceWrap ? "editor-wrap" : "editor-nowrap"}${showLineNumbers ? "" : " editor-hide-line-numbers"}${highlightCurrentLine ? "" : " editor-hide-current-line"}`}
        style={{ "--editor-font-size": `${editorFontSize}px` } as CSSProperties}
      >
        {showLineNumbers && (
          <div className="editor-line-numbers" ref={editorLineNumbersRef}>
            {lineNumbers.map((lineNumber, index) => {
              const lineDiagnostic = diagnosticsByLine.get(lineNumber);
              return (
                <span key={lineNumber} className={`editor-line-number-row${lineNumber === currentEditorLine ? " current" : ""}`} style={lineHeights[index] ? { height: lineHeights[index] } : undefined}>
                  {lineDiagnostic ? (
                    <button
                      type="button"
                      className={`editor-gutter-diagnostic ${lineDiagnostic.severity}`}
                      title={lineDiagnostic.tooltip}
                      aria-label={`Line ${lineNumber}: ${lineDiagnostic.tooltip}`}
                      onClick={() => selectDiagnosticRange(lineDiagnostic.diagnostic)}
                    />
                  ) : (
                    <span className="editor-gutter-spacer" aria-hidden="true" />
                  )}
                  <span className="editor-line-number-text" aria-hidden="true">
                    {lineNumber}
                  </span>
                </span>
              );
            })}
          </div>
        )}
        <div className="editor-source-layer">
          <pre className="editor-current-line" ref={editorCurrentLineRef} aria-hidden="true">
            {editorLines.map((line, index) => (
              <span
                key={index}
                ref={(element) => {
                  editorCurrentLineSpansRef.current[index] = element;
                }}
                className={index + 1 === currentEditorLine ? "current" : undefined}
              >
                {line || " "}
              </span>
            ))}
          </pre>
          <pre className="editor-highlights" ref={editorHighlightRef} aria-hidden="true">
            {diagnosticHighlights.map((part, index) =>
              part.severity ? (
                <mark key={index} className={`diagnostic-highlight ${part.severity}`} title={part.tooltip}>
                  {part.text}
                </mark>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </pre>
          <textarea
            ref={editorRef}
            value={source}
            onChange={(event) => updateSource(event.target.value, event.target.selectionStart)}
            onFocus={(event) => {
              onFocusEditor();
              updateCurrentEditorLine(event.currentTarget.selectionStart);
            }}
            onClick={(event) => updateCurrentEditorLine(event.currentTarget.selectionStart)}
            onKeyUp={(event) => updateCurrentEditorLine(event.currentTarget.selectionStart)}
            onSelect={(event) => updateCurrentEditorLine(event.currentTarget.selectionStart)}
            onScroll={syncEditorHighlightScroll}
            placeholder={t("sourcePlaceholder")}
            spellCheck={false}
            wrap={sourceWrap ? "soft" : "off"}
          />
        </div>
      </div>
      {diagnostics.length > 0 && (
        <div className="diagnostics">
          {diagnostics.map((diagnostic, index) => (
            <p key={index} className={diagnostic.severity}>
              {diagnostic.range ? (
                <button type="button" onClick={() => selectDiagnosticRange(diagnostic)}>
                  {`${diagnostic.range.start.line}:${diagnostic.range.start.column} ${diagnostic.message}`}
                </button>
              ) : (
                diagnostic.message
              )}
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
