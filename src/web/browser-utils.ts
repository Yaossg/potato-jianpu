export function openGrammarRailroad(language: "en" | "zh") {
  window.open(language === "zh" ? "grammar.zh.html" : "grammar.html", "_blank", "noopener,noreferrer");
}

export function waitForNextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}
