import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import type { Diagnostic } from "../core/model.js";
import { diagnosticHighlightParts, sourceLineAtOffset, sourceLineNumbers, sourceLines } from "./diagnostics.js";
import type { TranslationKey } from "./i18n.js";

interface SourceEditorProps {
  source: string;
  diagnostics: Diagnostic[];
  ok: boolean;
  summary: string;
  sourceWrap: boolean;
  t: (key: TranslationKey) => string;
  onSourceChange: (source: string) => void;
  onClearRequest: () => void;
  onFocusEditor: () => void;
}

export function SourceEditor({
  source,
  diagnostics,
  ok,
  summary,
  sourceWrap,
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
  const diagnosticHighlights = useMemo(() => diagnosticHighlightParts(source, diagnostics), [diagnostics, source]);
  const editorLines = useMemo(() => sourceLines(source), [source]);
  const lineNumbers = useMemo(() => sourceLineNumbers(source), [source]);

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
  }, [editorLines, sourceWrap]);

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
      <div className={`editor-field ${sourceWrap ? "editor-wrap" : "editor-nowrap"}`}>
        <div className="editor-line-numbers" ref={editorLineNumbersRef} aria-hidden="true">
          {lineNumbers.map((lineNumber, index) => (
            <span key={lineNumber} className={lineNumber === currentEditorLine ? "current" : undefined} style={lineHeights[index] ? { height: lineHeights[index] } : undefined}>
              {lineNumber}
            </span>
          ))}
        </div>
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
