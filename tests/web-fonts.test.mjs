import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as renderer from "../dist/renderer/index.js";
import * as dimensions from "../dist/renderer/dimensions.js";
import * as outlines from "../dist/renderer/smufl-outlines.js";
import { SMUFL_SYMBOLS } from "../dist/renderer/smufl.js";
import { createRequire } from "node:module";

async function loadModule(path, fetch, symbols = []) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, fetch, btoa,
    DOMParser: class {
      parseFromString() {
        return { querySelector: () => null, documentElement: {
          querySelector: () => ({ parentElement: {}, append() {} }),
          querySelectorAll: selector => selector === "text.smufl-symbol" ? symbols : [],
        }, createElementNS: (_ns, tag) => ({ tag, attrs: {}, setAttribute(key, value) { this.attrs[key] = value; } }) };
      }
    },
    require(path) {
      if (path.endsWith("?url")) return { default: path };
      if (path === "../renderer/index.js") return renderer;
      if (path === "../renderer/dimensions.js") return dimensions;
      if (path === "../renderer/smufl-outlines.js") return outlines;
      if (path === "jspdf") return { jsPDF: class {
        addFileToVFS() {} addFont() {} setFont() {} addPage() {}
        output() { return new ArrayBuffer(1); }
      } };
      if (path === "svg2pdf.js") return { svg2pdf: async () => {} };
      throw new Error(`Unexpected import ${path}`);
    },
  });
  return exports;
}

for (const format of ["svg", "png", "pdf"]) {
  test(`${format} font download can retry after failure and reuse a successful request`, async () => {
    let fail = true;
    let requests = 0;
    const api = await loadModule(format === "pdf" ? "../src/web/pdf-export.ts" : "../src/web/svg-fonts.ts", async () => {
      requests++;
      return { ok: !fail, status: fail ? 503 : 200, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
    });
    const svg = '<svg><defs></defs><text class="smufl-symbol">glyph</text></svg>';
    const run = () => format === "pdf" ? api.svgPagesToPdfBuffer([{ svg, width: 100, height: 100 }])
      : format === "png" ? api.embedPngExportFonts(svg) : api.embedSvgDownloadFonts(svg);
    await assert.rejects(run(), /503/);
    fail = false;
    const beforeRetry = requests;
    await Promise.all([run(), run()]);
    assert.equal(requests - beforeRetry, format === "svg" ? 1 : format === "pdf" ? 2 : 3);
    const afterRetry = requests;
    await run();
    assert.equal(requests, afterRetry);
  });
}

test("PDF music symbols use the bundled font's actual vector outlines", async () => {
  const require = createRequire(import.meta.resolve("pdfkit"));
  const font = require("fontkit").create(await readFile(new URL("../node_modules/@vexflow-fonts/bravura/bravura.otf", import.meta.url)));
  const characters = Object.values(SMUFL_SYMBOLS).map(entity => String.fromCodePoint(parseInt(entity.slice(3, -1), 16)));
  assert.deepEqual(Object.keys(outlines.SMUFL_OUTLINES).sort(), [...characters].sort());
  const replacements = [];
  const symbols = characters.map(textContent => ({
    textContent,
    attributes: [{ name: "class", value: "ornament smufl-symbol" }],
    getAttribute: key => ({ x: "50", y: "30", "text-anchor": "middle" })[key] ?? null,
    replaceWith: path => replacements.push(path),
  }));
  const api = await loadModule("../src/web/pdf-export.ts", async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }), symbols);
  await api.svgPagesToPdfBuffer([{ svg: "<svg/>", width: 100, height: 100 }]);
  assert.equal(replacements.length, characters.length);
  for (const [i, path] of replacements.entries()) {
    const glyph = font.glyphForCodePoint(characters[i].codePointAt(0));
    const scale = dimensions.DIMENSIONS.ornamentFontSize / font.unitsPerEm;
    assert.equal(path.tag, "path");
    assert.equal(path.attrs.d, glyph.path.toSVG());
    assert.equal(path.attrs.transform, `translate(${50 - glyph.advanceWidth * scale / 2}, 30) scale(${scale}, ${-scale})`);
    assert.equal(path.attrs.class, "ornament smufl-symbol");
  }
});
