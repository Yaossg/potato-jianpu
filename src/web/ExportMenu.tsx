import { useRef, useState } from "react";
import type { TranslationKey } from "./i18n.js";
import { ToolbarIcon } from "./ToolbarIcon.js";
import {
  DEFAULT_VIDEO_SCALE, DEFAULT_VIDEO_SETTINGS, DEFAULT_VIDEO_SIZE, VIDEO_BITRATES,
  VIDEO_FRAME_RATES, VIDEO_SCALES, VIDEO_SIZES, type VideoSettings,
} from "./video-settings.js";

type VideoSizeChoice = keyof typeof VIDEO_SIZES | "custom" | "page";
const { size: defaultSize, ...defaultVideoEncoding } = DEFAULT_VIDEO_SETTINGS;
const MAX_VIDEO_DIMENSION = 0xffffffff;

export interface VideoPageSize {
  width: number;
  height?: number;
}

interface ExportMenuProps {
  canExportScore: boolean;
  canExportImage: boolean;
  exportingAudio: "wav" | "mp3" | null;
  audioExportDetails: string;
  audioLoadingText?: string;
  exportingVideo: boolean;
  videoPageSize: VideoPageSize;
  t: (key: TranslationKey) => string;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportPdf: () => void;
  onExportMidi: () => void;
  onExportWav: () => void;
  onExportMp3: () => void;
  onExportVideo: (settings: VideoSettings) => void;
}

export function ExportMenu({
  canExportScore,
  canExportImage,
  exportingAudio,
  audioExportDetails,
  audioLoadingText,
  exportingVideo,
  videoPageSize,
  t,
  onExportSvg,
  onExportPng,
  onExportPdf,
  onExportMidi,
  onExportWav,
  onExportMp3,
  onExportVideo,
}: ExportMenuProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [videoSettings, setVideoSettings] = useState(defaultVideoEncoding);
  const [videoSizeChoice, setVideoSizeChoice] = useState<VideoSizeChoice>(DEFAULT_VIDEO_SIZE);
  const [draftSize, setDraftSize] = useState({ width: String(defaultSize.width), height: String(defaultSize.height) });
  const [scale, setScale] = useState(DEFAULT_VIDEO_SCALE);
  const videoDisabled = !canExportScore || !canExportImage || exportingAudio !== null || exportingVideo;
  const dimensionStep = videoSettings.format === "mp4" && scale % 2 !== 0 ? 2 : 1;
  const followPage = videoSizeChoice === "page";
  const inheritedWidth = followPage ? videoPageSize.width : undefined;
  const inheritedHeight = followPage ? videoPageSize.height : undefined;
  const width = inheritedWidth ?? Number(draftSize.width);
  const height = inheritedHeight ?? Number(draftSize.height);
  const maxBaseDimension = Math.floor(MAX_VIDEO_DIMENSION / scale);
  const validSize = [width, height].every(dimension =>
    Number.isInteger(dimension) && dimension > 0 && dimension <= maxBaseDimension
  );
  const outputSize = { width: width * scale, height: height * scale };
  const oddOutputSize = validSize && (outputSize.width % 2 !== 0 || outputSize.height % 2 !== 0);
  const incompatibleSize = oddOutputSize && videoSettings.format === "mp4";
  const cannotSubmit = videoDisabled || !validSize || incompatibleSize;

  return (
    <>
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
          <button type="button" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()} disabled={videoDisabled}>
            {t("exportVideo")}
          </button>
          {exportingAudio && <p className="export-status">{audioLoadingText || (audioExportDetails ? `${t("renderingLocally")}: ${audioExportDetails}` : `${t("renderingLocally")}...`)}</p>}
        </div>
      </details>
      <dialog className="video-export-dialog" ref={dialog} aria-labelledby="video-export-title">
        <form onSubmit={(event) => {
          event.preventDefault();
          if (cannotSubmit) return;
          dialog.current?.close();
          onExportVideo({ ...videoSettings, size: outputSize });
        }}>
          <h2 id="video-export-title">{t("exportVideo")}</h2>
          <label className="select-control">
            {t("videoSize")}
            <select value={videoSizeChoice} onChange={(event) => {
              const choice = event.target.value as VideoSizeChoice;
              setVideoSizeChoice(choice);
              if (choice !== "custom" && choice !== "page") {
                const { width, height } = VIDEO_SIZES[choice];
                setDraftSize({ width: String(width), height: String(height) });
              }
            }}>
              <option value="custom">{t("videoSizeCustom")}</option>
              <option value="page">{t("videoSizePage")}</option>
              {Object.entries(VIDEO_SIZES).map(([size, { width, height }]) => (
                <option key={size} value={size}>{width} × {height}</option>
              ))}
            </select>
          </label>
          {(videoSizeChoice === "custom" || followPage) && (
            <>
              {(["width", "height"] as const).map((dimension) => {
                const label = dimension === "width" ? "videoWidth" : "videoHeight";
                const inherited = dimension === "width" ? inheritedWidth : inheritedHeight;
                return (
                  <label key={dimension} className="number-control">
                    {t(label)}
                    <input
                      type="number"
                      value={inherited ?? draftSize[dimension]}
                      readOnly={inherited !== undefined}
                      onChange={(event) => setDraftSize({ ...draftSize, [dimension]: event.target.value })}
                      min={dimensionStep}
                      max={maxBaseDimension}
                      step={dimensionStep}
                      required={inherited === undefined}
                    />
                  </label>
                );
              })}
            </>
          )}
          <label className="select-control">
            {t("videoScale")}
            <select value={scale} onChange={(event) => setScale(Number(event.target.value))}>
              {VIDEO_SCALES.map((value) => <option key={value} value={value}>{value}×</option>)}
            </select>
          </label>
          {validSize && (
            <p className="settings-note" aria-live="polite">
              {t("videoOutputSize")} · {outputSize.width} × {outputSize.height} px
              {oddOutputSize && videoSettings.format !== "webm" && (
                <><br />{t(incompatibleSize ? "videoSizeEven" : "videoSizeAuto")}</>
              )}
            </p>
          )}
          <label className="select-control">
            {t("videoFrameRate")}
            <select value={videoSettings.frameRate} onChange={(event) => setVideoSettings({ ...videoSettings, frameRate: Number(event.target.value) as VideoSettings["frameRate"] })}>
              {VIDEO_FRAME_RATES.map((rate) => <option key={rate} value={rate}>{rate} fps</option>)}
            </select>
          </label>
          <label className="select-control">
            {t("videoQuality")}
            <select value={videoSettings.quality} onChange={(event) => setVideoSettings({ ...videoSettings, quality: event.target.value as VideoSettings["quality"] })}>
              {(Object.keys(VIDEO_BITRATES) as VideoSettings["quality"][]).map((quality) => (
                <option key={quality} value={quality}>{t(quality)} ({VIDEO_BITRATES[quality] / 1_000_000} Mbps)</option>
              ))}
            </select>
          </label>
          <label className="select-control">
            {t("videoFormat")}
            <select value={videoSettings.format} onChange={(event) => setVideoSettings({ ...videoSettings, format: event.target.value as VideoSettings["format"] })}>
              <option value="auto">{t("videoFormatAuto")}</option>
              <option value="mp4">MP4</option>
              <option value="webm">WebM</option>
            </select>
          </label>
          <label className="checkbox-control">
            <input type="checkbox" checked={videoSettings.highlight} onChange={(event) => setVideoSettings({ ...videoSettings, highlight: event.target.checked })} />
            {t("videoHighlight")}
          </label>
          <div className="dialog-actions">
            <button type="button" onClick={() => dialog.current?.close()}>{t("cancel")}</button>
            <button type="submit" disabled={cannotSubmit}>{t("export")}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}
