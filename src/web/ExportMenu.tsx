import type { TranslationKey } from "./i18n.js";

interface ExportMenuProps {
  canExportScore: boolean;
  canExportImage: boolean;
  exportingAudio: "wav" | "mp3" | null;
  audioExportDetails: string;
  t: (key: TranslationKey) => string;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportMidi: () => void;
  onExportWav: () => void;
  onExportMp3: () => void;
}

export function ExportMenu({
  canExportScore,
  canExportImage,
  exportingAudio,
  audioExportDetails,
  t,
  onExportSvg,
  onExportPng,
  onExportMidi,
  onExportWav,
  onExportMp3,
}: ExportMenuProps) {
  return (
    <details className="export-menu">
      <summary>{t("export")}</summary>
      <div className="export-menu-items">
        <button type="button" onClick={onExportSvg} disabled={!canExportImage}>
          SVG
        </button>
        <button type="button" onClick={onExportPng} disabled={!canExportImage}>
          PNG
        </button>
        <button type="button" onClick={onExportMidi} disabled={!canExportScore}>
          MIDI
        </button>
        <button type="button" onClick={onExportWav} disabled={!canExportScore || exportingAudio !== null}>
          {exportingAudio === "wav" ? `${t("exporting")} WAV...` : "WAV"}
        </button>
        <button type="button" onClick={onExportMp3} disabled={!canExportScore || exportingAudio !== null}>
          {exportingAudio === "mp3" ? `${t("exporting")} MP3...` : "MP3"}
        </button>
        {exportingAudio && <p className="export-status">{audioExportDetails ? `${t("renderingLocally")}: ${audioExportDetails}` : `${t("renderingLocally")}...`}</p>}
      </div>
    </details>
  );
}
