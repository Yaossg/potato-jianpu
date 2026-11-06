import type { TranslationKey } from "./i18n.js";
import { ToolbarIcon } from "./ToolbarIcon.js";

interface ExportMenuProps {
  canExportScore: boolean;
  canExportImage: boolean;
  exportingAudio: "wav" | "mp3" | null;
  audioExportDetails: string;
  audioLoadingText?: string;
  exportingVideo: boolean;
  t: (key: TranslationKey) => string;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportMidi: () => void;
  onExportWav: () => void;
  onExportMp3: () => void;
  onExportVideo: () => void;
}

export function ExportMenu({
  canExportScore,
  canExportImage,
  exportingAudio,
  audioExportDetails,
  audioLoadingText,
  exportingVideo,
  t,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onExportMidi,
  onExportWav,
  onExportMp3,
  onExportVideo,
}: ExportMenuProps) {
  return (
    <details className="export-menu">
      <summary className="icon-button" aria-label={t("export")} title={t("export")}>
        <ToolbarIcon name="export" />
      </summary>
      <div className="export-menu-items">
        <button type="button" onClick={onExportSvg} disabled={!canExportImage}>
          SVG
        </button>
        <button type="button" onClick={onExportPng} disabled={!canExportImage}>
          PNG
        </button>
        <button type="button" onClick={onExportPdf} disabled={!canExportImage}>
          PDF
        </button>
        <button type="button" onClick={onExportMidi} disabled={!canExportScore}>
          MIDI
        </button>
        <button type="button" onClick={onExportWav} disabled={!canExportScore || exportingAudio !== null || exportingVideo}>
          {exportingAudio === "wav" ? `${t("exporting")} WAV...` : "WAV"}
        </button>
        <button type="button" onClick={onExportMp3} disabled={!canExportScore || exportingAudio !== null || exportingVideo}>
          {exportingAudio === "mp3" ? `${t("exporting")} MP3...` : "MP3"}
        </button>
        <button type="button" onClick={onExportVideo} disabled={!canExportScore || !canExportImage || exportingAudio !== null || exportingVideo}>
          {t("exportVideo")}
        </button>
        {exportingAudio && <p className="export-status">{audioLoadingText || (audioExportDetails ? `${t("renderingLocally")}: ${audioExportDetails}` : `${t("renderingLocally")}...`)}</p>}
      </div>
    </details>
  );
}
