import { openGrammarRailroad } from "./browser-utils.js";
import { ExportMenu } from "./ExportMenu.js";
import type { Language, TranslationKey } from "./i18n.js";
import type { ThemeName } from "./theme.js";
import { ToolbarIcon } from "./ToolbarIcon.js";

interface ToolbarProps {
  language: Language;
  theme: ThemeName;
  isPlaying: boolean;
  canPlay: boolean;
  canExportScore: boolean;
  canExportImage: boolean;
  exportingAudio: "wav" | "mp3" | null;
  audioExportDetails: string;
  t: (key: TranslationKey) => string;
  onToggleLanguage: () => void;
  onToggleTheme: () => void;
  onToggleSettings: () => void;
  onToggleExamples: () => void;
  onPlay: () => void;
  onStop: () => void;
  onExportSvg: () => void;
  onExportPng: () => void;
  onExportMidi: () => void;
  onExportWav: () => void;
  onExportMp3: () => void;
}

export function Toolbar({
  language,
  theme,
  isPlaying,
  canPlay,
  canExportScore,
  canExportImage,
  exportingAudio,
  audioExportDetails,
  t,
  onToggleLanguage,
  onToggleTheme,
  onToggleSettings,
  onToggleExamples,
  onPlay,
  onStop,
  onExportSvg,
  onExportPng,
  onExportMidi,
  onExportWav,
  onExportMp3,
}: ToolbarProps) {
  return (
    <div className="actions">
      <button type="button" className="icon-button" onClick={onToggleLanguage} aria-label={`${t("language")}: ${language === "en" ? t("english") : t("chinese")}`} title={`${t("language")}: ${language === "en" ? t("english") : t("chinese")}`}>
        <ToolbarIcon name="language" />
      </button>
      <button type="button" className="icon-button" onClick={onToggleTheme} aria-label={`${t("theme")}: ${theme === "light" ? t("light") : t("dark")}`} title={`${t("theme")}: ${theme === "light" ? t("light") : t("dark")}`}>
        <ToolbarIcon name={theme === "light" ? "light" : "dark"} />
      </button>
      <button type="button" className="icon-button" onClick={() => openGrammarRailroad(language)} aria-label={t("help")} title={t("help")}>
        <ToolbarIcon name="help" />
      </button>
      <button type="button" className="icon-button" onClick={onToggleSettings} aria-label={t("settings")} title={t("settings")}>
        <ToolbarIcon name="settings" />
      </button>
      <button type="button" className="icon-button" onClick={onToggleExamples} aria-label={t("examples")} title={t("examples")}>
        <ToolbarIcon name="examples" />
      </button>
      {isPlaying ? (
        <button type="button" className="icon-button playback-button stop-button" onClick={onStop} aria-label={t("stop")} title={t("stop")}>
          <ToolbarIcon name="stop" />
        </button>
      ) : (
        <button type="button" className="icon-button playback-button play-button" onClick={onPlay} disabled={!canPlay} aria-label={t("play")} title={t("play")}>
          <ToolbarIcon name="play" />
        </button>
      )}
      <ExportMenu
        canExportScore={canExportScore}
        canExportImage={canExportImage}
        exportingAudio={exportingAudio}
        audioExportDetails={audioExportDetails}
        t={t}
        onExportSvg={onExportSvg}
        onExportPng={onExportPng}
        onExportMidi={onExportMidi}
        onExportWav={onExportWav}
        onExportMp3={onExportMp3}
      />
    </div>
  );
}
