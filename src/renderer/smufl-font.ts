const BRAVURA_FONT_FACE_PREFIX = `@font-face { font-family: Bravura; font-style: normal; font-weight: 400; font-display: block; src: url("data:font/woff2;base64,`;
const BRAVURA_FONT_FACE_SUFFIX = `") format("woff2"); }`;

export function bravuraFontFaceCss(woff2Base64: string): string {
  return `${BRAVURA_FONT_FACE_PREFIX}${woff2Base64}${BRAVURA_FONT_FACE_SUFFIX}`;
}

export function embedBravuraFontFace(svg: string, woff2Base64: string): string {
  if (!svg.includes("smufl-symbol") || svg.includes("@font-face { font-family: Bravura;")) {
    return svg;
  }
  return svg.replace("<style>\n", `<style>\n${bravuraFontFaceCss(woff2Base64)}\n`);
}
