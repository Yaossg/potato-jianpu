import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
import * as renderer from "../dist/renderer/index.js";

async function loadModule(path, fetch) {
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
          querySelector: () => ({ parentElement: {}, append() {} }), querySelectorAll: () => [],
        }, createElementNS: () => ({}) };
      }
    },
    require(path) {
      if (path.endsWith("?url")) return { default: path };
      if (path === "../renderer/index.js") return renderer;
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
    assert.equal(requests - beforeRetry, format === "svg" ? 1 : 3);
    const afterRetry = requests;
    await run();
    assert.equal(requests, afterRetry);
  });
}
