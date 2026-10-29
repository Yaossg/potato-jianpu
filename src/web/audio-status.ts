import type { AudioLoadStatus } from "./soundfont.js";
import type { TranslationKey } from "./i18n.js";

export function audioLoadMessage(status: AudioLoadStatus, t: (key: TranslationKey) => string): string {
  if (status.phase === "preparing") return t("audioPreparing");
  const loaded = (status.loaded / 1_000_000).toFixed(1);
  const amount = status.total
    ? `${loaded} / ${(status.total / 1_000_000).toFixed(1)} MB · ${Math.min(100, Math.floor(status.loaded / status.total * 100))}%`
    : `${loaded} MB`;
  return `${t("audioDownloading")} · ${amount}`;
}
