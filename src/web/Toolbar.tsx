import { openGrammarRailroad } from "./browser-utils.js";
import { ExportMenu } from "./ExportMenu.js";
import type { Language, TranslationKey } from "./i18n.js";
import type { ThemeName } from "./theme.js";

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
      <button type="button" onClick={onToggleLanguage}>
        {t("language")}: {language === "en" ? t("english") : t("chinese")}
      </button>
      <button type="button" onClick={onToggleTheme}>
        {t("theme")}: {theme === "light" ? t("light") : t("dark")}
      </button>
      <button type="button" onClick={() => openGrammarRailroad(language)}>
        {t("help")}
      </button>
      <button type="button" onClick={onToggleSettings}>
        {t("settings")}
      </button>
      <button type="button" onClick={onToggleExamples}>
        {t("examples")}
      </button>
      {isPlaying ? (
        <button type="button" onClick={onStop}>
          {t("stop")}
        </button>
      ) : (
        <button type="button" onClick={onPlay} disabled={!canPlay}>
          {t("play")}
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
