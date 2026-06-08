export function openGrammarHelp(language: "en" | "zh") {
  const path = language === "zh" ? "docs/zh/" : "docs/";
  window.open(new URL(path, window.location.href), "_blank", "noopener,noreferrer");
}

export function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
