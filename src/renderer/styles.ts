import { DIMENSIONS } from "./dimensions.js";

export const SVG_STYLE = `.title { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 32px; font-weight: 700; }
.subtitle { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 400; }
.metadata { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: 400; }
.page-footer, .page-number { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 400; }
.page-number { font-variant-numeric: tabular-nums; }
.measure-number { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 400; font-variant-numeric: tabular-nums; }
.key-signature .note { font-size: 20px; font-weight: 700; }
.key-signature .metadata { font-size: 20px; font-weight: 400; }
.time-signature { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: 700; }
.time-signature-line { stroke: currentColor; stroke-width: 1.5; stroke-linecap: butt; }
.line-label { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: ${DIMENSIONS.labelFontSize}px; font-weight: 700; }
.lyric-line { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: 400; }
.lyric-syllable { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 17px; font-weight: 400; }
.lyric-latin { font-size: 13px; }
.voice-bracket { stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: butt; stroke-linejoin: miter; }
.voice-bracket-stem { stroke: currentColor; stroke-width: 3; fill: none; stroke-linecap: butt; }
.note { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: 700; }
.accidental { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; text-anchor: middle; }
.dot { fill: currentColor; }
.bar-thin { stroke: currentColor; stroke-width: ${DIMENSIONS.barThinStrokeWidth}; stroke-linecap: butt; }
.bar-final { stroke: currentColor; stroke-width: ${DIMENSIONS.barFinalStrokeWidth}; stroke-linecap: butt; }
.repeat-dot { fill: currentColor; }
.ending-line { stroke: currentColor; stroke-width: 2; fill: none; }
.ending-label { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: 14px; font-weight: 700; }
.navigation-target, .navigation-instruction { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: ${DIMENSIONS.navigationTextFontSize}px; font-style: italic; font-weight: 700; }
.navigation-symbol { font-family: "Noto Music", "Segoe UI Symbol", "Noto Sans Symbols 2", "DejaVu Sans", Arial, Helvetica, sans-serif; font-size: ${DIMENSIONS.navigationSymbolFontSize}px; font-style: normal; font-weight: 400; }
.navigation-coda-symbol { font-size: ${DIMENSIONS.navigationCodaFontSize}px; }
.navigation-target-text { font-size: ${DIMENSIONS.navigationTextFontSize}px; }
.tempo-mark { fill: currentColor; font-family: "Segoe UI Symbol", "Noto Music", "Noto Sans Symbols 2", Arial, Helvetica, sans-serif; font-size: 22px; font-weight: 400; }
.tempo-value { font-size: 20px; }
.underline { stroke: currentColor; stroke-width: 2.5; }
.dash { stroke: currentColor; stroke-width: 3; }
.tie { fill: currentColor; stroke: currentColor; stroke-width: ${DIMENSIONS.tieStrokeWidth}; }
.slur { fill: none; stroke: currentColor; stroke-width: ${DIMENSIONS.slurStrokeWidth}; stroke-linecap: butt; }
.slur-count { fill: currentColor; font-family: Arial, Helvetica, sans-serif; font-size: ${DIMENSIONS.slurCountFontSize}px; font-weight: 700; }
.ornament { fill: none; stroke: currentColor; stroke-width: ${DIMENSIONS.ornamentStrokeWidth}; stroke-linecap: round; stroke-linejoin: round; }
.grace-arc { stroke-width: 1; stroke-linecap: butt; stroke-linejoin: miter; }
.smufl-symbol { fill: currentColor; stroke: none; font-family: Bravura, "Noto Music", "Segoe UI Symbol", sans-serif; font-size: ${DIMENSIONS.ornamentFontSize}px; font-weight: 400; pointer-events: none; }
.hairpin { stroke: currentColor; stroke-width: ${DIMENSIONS.hairpinStrokeWidth}; stroke-linecap: butt; }
.velocity { fill: currentColor; font-family: 'Georgia Pro', Georgia, 'DejaVu Serif', Times, 'Times New Roman', FreeSerif, 'DejaVu Math TeX', serif; font-size: ${DIMENSIONS.velocityFontSize}px; font-style: italic; font-weight: bold; }
.note-item { cursor: pointer; }
.note-item.active .note, .note-item.active .accidental, .note-item.active .dot, .note-item.active .velocity, .note-item.active .smufl-symbol { fill: #dc2626; }
.note-item.active .underline, .note-item.active .dash, .note-item.active .ornament { stroke: #dc2626; }`;
