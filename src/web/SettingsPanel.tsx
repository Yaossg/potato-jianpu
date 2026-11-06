import { useEffect, useState } from "react";
import type { KeyboardEvent } from "react";
import { DRUM_PROGRAMS, GM_PROGRAMS } from "../index.js";
import { PAGE_ORIENTATIONS, PAPER_PRESET_LIST, isPageOrientation, isPaperPresetName, resolvePageSize } from "../renderer/index.js";
import type { PageOrientation, PaperPresetName } from "../renderer/index.js";
import type { JustifyMode, PageWidthMode, TranslationKey } from "./i18n.js";
import { PNG_SCALE_OPTIONS } from "./downloads.js";

type PaperSelection = PaperPresetName | "custom";

interface SettingsPanelProps {
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  pageWidthMode: PageWidthMode;
  paperPreset: PaperSelection;
  pageOrientation: PageOrientation;
  panelPageWidth: number;
  contentPageWidth: number;
  manualPageWidth: number;
  minPageWidth: number;
  maxPageWidth: number;
  paginate: boolean;
  effectivePaginate: boolean;
  pageHeight: number;
  minPageHeight: number;
  maxPageHeight: number;
  pageMargin: number;
  minPageMargin: number;
  maxPageMargin: number;
  pageNumbers: boolean;
  measureNumbers: boolean;
  pageWarnings: string[];
  scoreColor: string;
  pageBackground: string;
  justifyMode: JustifyMode;
  program: number;
  trackProgramOverrideCount: number;
  volume: number;
  audioSampleRate: number;
  pngScale: number;
  pngPixelWidth: number;
  pngPixelHeight: number;
  splitPages: boolean;
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
  onPaperPresetChange: (preset: PaperSelection) => void;
  onPageOrientationChange: (orientation: PageOrientation) => void;
  onManualPageWidthChange: (width: number) => void;
  onPaginateChange: (paginate: boolean) => void;
  onPageHeightChange: (height: number) => void;
  onPageMarginChange: (margin: number) => void;
  onPageNumbersChange: (enabled: boolean) => void;
  onMeasureNumbersChange: (enabled: boolean) => void;
  onScoreColorChange: (color: string) => void;
  onPageBackgroundChange: (color: string) => void;
  onJustifyModeChange: (mode: JustifyMode) => void;
  onProgramChange: (program: number) => void;
  onVolumeChange: (volume: number) => void;
  onAudioSampleRateChange: (sampleRate: number) => void;
  onPngScaleChange: (scale: number) => void;
  onSplitPagesChange: (split: boolean) => void;
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

function toPaperPreset(value: string): PaperSelection {
  return isPaperPresetName(value) ? value : "custom";
}

function toPageOrientation(value: string): PageOrientation {
  return isPageOrientation(value) ? value : "portrait";
}

function toJustifyMode(value: string): JustifyMode {
  return value === "except-last" || value === "all" ? value : "none";
}

function clampRounded(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") {
    event.currentTarget.blur();
  }
}

function useClampedNumberDraft(value: number, min: number, max: number, onChange: (value: number) => void) {
  const [draft, setDraft] = useState(() => String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function update(draftValue: string) {
    setDraft(draftValue);
    if (draftValue.trim() === "") {
      return;
    }
    const nextValue = Number(draftValue);
    if (Number.isFinite(nextValue) && nextValue >= min && nextValue <= max) {
      onChange(Math.round(nextValue));
    }
  }

  function commit() {
    const nextValue = Number(draft);
    if (!Number.isFinite(nextValue)) {
      setDraft(String(value));
      return;
    }
    const clampedValue = clampRounded(nextValue, min, max);
    setDraft(String(clampedValue));
    onChange(clampedValue);
  }

  return { commit, draft, update };
}

export function SettingsPanel({
  t,
  pageWidthMode,
  paperPreset,
  pageOrientation,
  panelPageWidth,
  contentPageWidth,
  manualPageWidth,
  minPageWidth,
  maxPageWidth,
  paginate,
  effectivePaginate,
  pageHeight,
  minPageHeight,
  maxPageHeight,
  pageMargin,
  minPageMargin,
  maxPageMargin,
  pageNumbers,
  measureNumbers,
  pageWarnings,
  scoreColor,
  pageBackground,
  justifyMode,
  program,
  trackProgramOverrideCount,
  volume,
  audioSampleRate,
  pngScale,
  pngPixelWidth,
  pngPixelHeight,
  splitPages,
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
  onPaperPresetChange,
  onPageOrientationChange,
  onManualPageWidthChange,
  onPaginateChange,
  onPageHeightChange,
  onPageMarginChange,
  onPageNumbersChange,
  onMeasureNumbersChange,
  onScoreColorChange,
  onPageBackgroundChange,
  onJustifyModeChange,
  onProgramChange,
  onVolumeChange,
  onAudioSampleRateChange,
  onPngScaleChange,
  onSplitPagesChange,
  onOmitInitialRestsChange,
  onSourceWrapChange,
  onEditorFontSizeChange,
  onShowLineNumbersChange,
  onHighlightCurrentLineChange,
  onHighlightDiagnosticsChange,
  onAuditionProgram,
}: SettingsPanelProps) {
  const usesCustomPageSize = paperPreset === "custom";
  const presetPageSize = resolvePageSize({
    paper: paperPreset === "custom" ? undefined : paperPreset,
    orientation: pageOrientation,
  });
  const customPageWidth = pageWidthMode === "panel" ? panelPageWidth : pageWidthMode === "content" ? contentPageWidth : manualPageWidth;
  const displayedPageWidth = usesCustomPageSize ? customPageWidth : presetPageSize.pageWidth;
  const pageWidthDraft = useClampedNumberDraft(displayedPageWidth, minPageWidth, maxPageWidth, onManualPageWidthChange);
  const pageMarginDraft = useClampedNumberDraft(pageMargin, minPageMargin, maxPageMargin, onPageMarginChange);
  const pageHeightDraft = useClampedNumberDraft(pageHeight, minPageHeight, maxPageHeight, onPageHeightChange);
  const editorFontSizeDraft = useClampedNumberDraft(editorFontSize, minEditorFontSize, maxEditorFontSize, onEditorFontSizeChange);

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
              {t("paper")}
              <select value={paperPreset} onChange={(event) => onPaperPresetChange(toPaperPreset(event.target.value))}>
                <option value="custom">{t("custom")}</option>
                {PAPER_PRESET_LIST.map((preset) => (
                  <option key={preset.name} value={preset.name}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
            {!usesCustomPageSize && (
              <label className="select-control">
                {t("orientation")}
                <select value={pageOrientation} onChange={(event) => onPageOrientationChange(toPageOrientation(event.target.value))}>
                  {PAGE_ORIENTATIONS.map((orientation) => (
                    <option key={orientation} value={orientation}>
                      {t(orientation)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="select-control">
              {t("widthMode")}
              <select
                value={pageWidthMode}
                disabled={!usesCustomPageSize}
                onChange={(event) => onPageWidthModeChange(toPageWidthMode(event.target.value))}
              >
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
                value={pageWidthDraft.draft}
                disabled={!usesCustomPageSize || pageWidthMode !== "manual"}
                onChange={(event) => pageWidthDraft.update(event.target.value)}
                onBlur={pageWidthDraft.commit}
                onKeyDown={blurOnEnter}
              />
            </label>
            <label className="number-control">
              {t("pageMargin")}
              <input
                type="number"
                min={minPageMargin}
                max={maxPageMargin}
                step={10}
                value={pageMarginDraft.draft}
                onChange={(event) => pageMarginDraft.update(event.target.value)}
                onBlur={pageMarginDraft.commit}
                onKeyDown={blurOnEnter}
              />
            </label>
            <label className="checkbox-control">
              <input type="checkbox" checked={paginate} onChange={(event) => onPaginateChange(event.target.checked)} />
              {t("paginate")}
            </label>
            {effectivePaginate && (
              <label className="number-control">
                {t("pageHeight")}
                <input
                  type="number"
                  min={minPageHeight}
                  max={maxPageHeight}
                  step={20}
                  value={pageHeightDraft.draft}
                  disabled={!usesCustomPageSize}
                  onChange={(event) => pageHeightDraft.update(event.target.value)}
                  onBlur={pageHeightDraft.commit}
                  onKeyDown={blurOnEnter}
                />
              </label>
            )}
            <label className="checkbox-control">
              <input type="checkbox" checked={measureNumbers} onChange={(event) => onMeasureNumbersChange(event.target.checked)} />
              {t("measureNumbers")}
            </label>
            {effectivePaginate && (
              <label className="checkbox-control">
                <input type="checkbox" checked={pageNumbers} onChange={(event) => onPageNumbersChange(event.target.checked)} />
                {t("pageNumbers")}
              </label>
            )}
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
          {pageWarnings.length > 0 && (
            <div className="settings-warnings" role="status">
              {pageWarnings.map((warning) => (
                <p key={warning}>{warning}</p>
              ))}
            </div>
          )}
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
                value={editorFontSizeDraft.draft}
                onChange={(event) => editorFontSizeDraft.update(event.target.value)}
                onBlur={editorFontSizeDraft.commit}
                onKeyDown={blurOnEnter}
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
            <label className="checkbox-control">
              <input type="checkbox" checked={omitInitialRests} onChange={(event) => onOmitInitialRestsChange(event.target.checked)} />
              {t("omitInitialRests")}
            </label>
            <button type="button" onClick={onAuditionProgram}>
              {t("audition")}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>{t("exportSettings")}</h3>
          <div className="settings-grid page-settings-grid">
            <label className="select-control">
              {t("pngScale")}
              <select value={pngScale} onChange={(event) => onPngScaleChange(Number(event.target.value))}>
                {PNG_SCALE_OPTIONS.map((scale) => (
                  <option key={scale} value={scale}>
                    {scale}×
                  </option>
                ))}
              </select>
            </label>
            <p className="settings-note">{t("pngSize", { width: pngPixelWidth, height: pngPixelHeight })}</p>
            <label className="checkbox-control">
              <input type="checkbox" checked={splitPages} onChange={(event) => onSplitPagesChange(event.target.checked)} />
              {t("splitPages")}
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
          </div>
        </section>
      </div>
    </section>
  );
}
