import { useEffect, useState } from "react";
import { DRUM_PROGRAMS, GM_PROGRAMS } from "../index.js";
import type { JustifyMode, PageWidthMode, TranslationKey } from "./i18n.js";

interface SettingsPanelProps {
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  pageWidthMode: PageWidthMode;
  panelPageWidth: number;
  contentPageWidth: number;
  manualPageWidth: number;
  minPageWidth: number;
  maxPageWidth: number;
  scoreColor: string;
  pageBackground: string;
  justifyMode: JustifyMode;
  program: number;
  trackProgramOverrideCount: number;
  volume: number;
  audioSampleRate: number;
  omitInitialRests: boolean;
  sourceWrap: boolean;
  editorFontSize: number;
  minEditorFontSize: number;
  maxEditorFontSize: number;
  showLineNumbers: boolean;
  highlightCurrentLine: boolean;
  highlightDiagnostics: boolean;
  onClose: () => void;
  onPageWidthModeChange: (mode: PageWidthMode) => void;
  onManualPageWidthChange: (width: number) => void;
  onScoreColorChange: (color: string) => void;
  onPageBackgroundChange: (color: string) => void;
  onJustifyModeChange: (mode: JustifyMode) => void;
  onProgramChange: (program: number) => void;
  onVolumeChange: (volume: number) => void;
  onAudioSampleRateChange: (sampleRate: number) => void;
  onOmitInitialRestsChange: (omit: boolean) => void;
  onSourceWrapChange: (wrap: boolean) => void;
  onEditorFontSizeChange: (fontSize: number) => void;
  onShowLineNumbersChange: (show: boolean) => void;
  onHighlightCurrentLineChange: (highlight: boolean) => void;
  onHighlightDiagnosticsChange: (highlight: boolean) => void;
  onAuditionProgram: () => void;
}

function toPageWidthMode(value: string): PageWidthMode {
  return value === "content" || value === "manual" ? value : "panel";
}

function toJustifyMode(value: string): JustifyMode {
  return value === "except-last" || value === "all" ? value : "none";
}

function clampRounded(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function SettingsPanel({
  t,
  pageWidthMode,
  panelPageWidth,
  contentPageWidth,
  manualPageWidth,
  minPageWidth,
  maxPageWidth,
  scoreColor,
  pageBackground,
  justifyMode,
  program,
  trackProgramOverrideCount,
  volume,
  audioSampleRate,
  omitInitialRests,
  sourceWrap,
  editorFontSize,
  minEditorFontSize,
  maxEditorFontSize,
  showLineNumbers,
  highlightCurrentLine,
  highlightDiagnostics,
  onClose,
  onPageWidthModeChange,
  onManualPageWidthChange,
  onScoreColorChange,
  onPageBackgroundChange,
  onJustifyModeChange,
  onProgramChange,
  onVolumeChange,
  onAudioSampleRateChange,
  onOmitInitialRestsChange,
  onSourceWrapChange,
  onEditorFontSizeChange,
  onShowLineNumbersChange,
  onHighlightCurrentLineChange,
  onHighlightDiagnosticsChange,
  onAuditionProgram,
}: SettingsPanelProps) {
  const displayedPageWidth = pageWidthMode === "panel" ? panelPageWidth : pageWidthMode === "content" ? contentPageWidth : manualPageWidth;
  const [editorFontSizeDraft, setEditorFontSizeDraft] = useState(() => String(editorFontSize));

  useEffect(() => {
    setEditorFontSizeDraft(String(editorFontSize));
  }, [editorFontSize]);

  function commitEditorFontSizeDraft() {
    const value = Number(editorFontSizeDraft);
    if (!Number.isFinite(value)) {
      setEditorFontSizeDraft(String(editorFontSize));
      return;
    }
    const nextFontSize = clampRounded(value, minEditorFontSize, maxEditorFontSize);
    setEditorFontSizeDraft(String(nextFontSize));
    onEditorFontSizeChange(nextFontSize);
  }

  return (
    <section className="settings-panel">
      <div className="panel-title">
        <h2>{t("settingsTitle")}</h2>
        <button type="button" onClick={onClose}>
          {t("close")}
        </button>
      </div>
      <div className="settings-sections">
        <section className="settings-section">
          <h3>{t("pageSettings")}</h3>
          <div className="settings-grid">
            <label className="select-control">
              {t("widthMode")}
              <select value={pageWidthMode} onChange={(event) => onPageWidthModeChange(toPageWidthMode(event.target.value))}>
                <option value="panel">{t("panel")}</option>
                <option value="content">{t("content")}</option>
                <option value="manual">{t("manual")}</option>
              </select>
            </label>
            <label className="number-control">
              {t("width")}
              <input
                type="number"
                min={minPageWidth}
                max={maxPageWidth}
                step={20}
                value={displayedPageWidth}
                disabled={pageWidthMode !== "manual"}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value > 0) {
                    onManualPageWidthChange(Math.min(maxPageWidth, Math.max(minPageWidth, Math.round(value))));
                  }
                }}
              />
            </label>
            <label className="color-control">
              {t("color")}
              <input type="color" value={scoreColor} onChange={(event) => onScoreColorChange(event.target.value)} />
            </label>
            <label className="color-control">
              {t("page")}
              <input type="color" value={pageBackground} onChange={(event) => onPageBackgroundChange(event.target.value)} />
            </label>
            <label className="select-control">
              {t("justify")}
              <select value={justifyMode} onChange={(event) => onJustifyModeChange(toJustifyMode(event.target.value))}>
                <option value="none">{t("none")}</option>
                <option value="except-last">{t("exceptLastLine")}</option>
                <option value="all">{t("allLines")}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="settings-section">
          <h3>{t("editorSettings")}</h3>
          <div className="settings-grid">
            <label className="checkbox-control">
              <input type="checkbox" checked={sourceWrap} onChange={(event) => onSourceWrapChange(event.target.checked)} />
              {t("sourceWrap")}
            </label>
            <label className="number-control">
              {t("editorFontSize")}
              <input
                type="number"
                min={minEditorFontSize}
                max={maxEditorFontSize}
                step={1}
                value={editorFontSizeDraft}
                onChange={(event) => {
                  const draft = event.target.value;
                  setEditorFontSizeDraft(draft);
                  const value = Number(draft);
                  if (Number.isFinite(value) && value >= minEditorFontSize && value <= maxEditorFontSize) {
                    onEditorFontSizeChange(Math.round(value));
                  }
                }}
                onBlur={commitEditorFontSizeDraft}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={showLineNumbers} onChange={(event) => onShowLineNumbersChange(event.target.checked)} />
              {t("showLineNumbers")}
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={highlightCurrentLine} onChange={(event) => onHighlightCurrentLineChange(event.target.checked)} />
              {t("highlightCurrentLine")}
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={highlightDiagnostics} onChange={(event) => onHighlightDiagnosticsChange(event.target.checked)} />
              {t("highlightDiagnostics")}
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
                  if (Number.isInteger(value) && value >= 0 && value <= 174) {
                    onProgramChange(value);
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
            {trackProgramOverrideCount > 0 && <p className="settings-note">{t("trackProgramOverrides", { count: trackProgramOverrideCount })}</p>}
            <label className="range-control">
              {t("volume")}
              <input type="range" min={0} max={200} step={1} value={volume} onChange={(event) => onVolumeChange(Number(event.target.value))} />
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
                    onAudioSampleRateChange(Math.round(value));
                  }
                }}
              />
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={omitInitialRests} onChange={(event) => onOmitInitialRestsChange(event.target.checked)} />
              {t("omitInitialRests")}
            </label>
            <button type="button" onClick={onAuditionProgram}>
              {t("audition")}
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
