const BRAVURA_FONT_FACE_PREFIX = `@font-face { font-family: Bravura; font-style: normal; font-weight: 400; font-display: block; src: url("data:font/woff2;base64,`;
const BRAVURA_FONT_FACE_SUFFIX = `") format("woff2"); }`;
const SMUFL_SYMBOL_CLASS_PATTERN = /<[A-Za-z][\w:.-]*\b[^>]*\bclass\s*=\s*(?:"[^"]*\bsmufl-symbol\b[^"]*"|'[^']*\bsmufl-symbol\b[^']*')/;

export function bravuraFontFaceCss(woff2Base64: string): string {
  return `${BRAVURA_FONT_FACE_PREFIX}${woff2Base64}${BRAVURA_FONT_FACE_SUFFIX}`;
}

export function svgUsesSmuflSymbols(svg: string): boolean {
  return SMUFL_SYMBOL_CLASS_PATTERN.test(svg);
}

export function embedBravuraFontFace(svg: string, woff2Base64: string): string {
  if (!svgUsesSmuflSymbols(svg) || svg.includes("@font-face { font-family: Bravura;")) {
    return svg;
  }
  return svg.replace("<style>\n", `<style>\n${bravuraFontFaceCss(woff2Base64)}\n`);
}
