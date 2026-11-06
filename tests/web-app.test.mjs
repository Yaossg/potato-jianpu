import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";
import * as shared from "../dist/index.js";
import * as renderer from "../dist/renderer/index.js";

const require = createRequire(import.meta.url);
const source = await readFile(new URL("../src/web/App.tsx", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
});

// Execute App's actual event handlers and renderer calls with deterministic hooks.
// This checks application wiring; it does not simulate browser layout or effects.
function app(score = "1 2 3 4", preferences = {}) {
  const slots = [];
  let cursor = 0;
  let tree;
  const downloads = [];
  const audioOptions = [];
  const videoOptions = [];
  const alerts = [];
  const storage = new Map(Object.entries({ "modern-jianpu-markup-source": score, ...preferences }));
  const exports = {};
  const imports = {
    react: {
      useState(initial) {
        const i = cursor++;
        if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
        return [slots[i], value => { slots[i] = typeof value === "function" ? value(slots[i]) : value; }];
      },
      useRef(initial) {
        const i = cursor++;
        return slots[i] ??= { current: initial };
      },
      useMemo: fn => fn(),
      useEffect() {},
    },
    "react/jsx-runtime": require("react/jsx-runtime"),
    "../index.js": shared,
    "../renderer/index.js": renderer,
    "./audio.js": { PreviewAudioPlayer: class {
      async play(_arrangement, _onEnded, onNotes) { onNotes?.([0]); }
      stop() {}
    } },
    "./audio-status.js": { audioLoadMessage: () => "" },
    "./browser-utils.js": { waitForNextFrame: async () => {} },
    "./downloads.js": {
      DEFAULT_PNG_SCALE: 2,
      pngPixelDimensions: () => ({ width: 100, height: 100 }),
      downloadBytes: data => downloads.push(data),
      downloadBlob: data => downloads.push(data),
      svgToPngBlob: async svg => svg,
    },
    "./export-filename.js": { exportFilename: () => "score", splitPageExportFilename: () => "page" },
    "./i18n.js": { isLanguage: v => v === "en", translate: (_lang, key) => key, pageWidthModeLabels: {} },
    "./theme.js": { initialTheme: () => "light", themeColors: () => ({ scoreColor: "#000000", pageBackground: "#ffffff" }) },
    "./svg-fonts.js": { embedSvgDownloadFonts: async svg => svg },
    "./pdf-export.js": { svgPagesToPdfBuffer: async pages => pages.map(page => page.svg).join("\n") },
    "./video-export.js": {
      VideoUnsupportedError: class extends Error {},
      exportBrowserVideo: async (document, options) => {
        videoOptions.push({ document, ...options });
        options.onProgress("rendering", 0.5);
        return { blob: "video", extension: "mp4" };
      },
    },
    "./audio-export.js": Object.fromEntries(["exportBrowserWavBytes", "exportBrowserMp3Bytes"].map(name => [name, async (_doc, options) => {
      audioOptions.push(options);
      return new Uint8Array();
    }])),
  };
  for (const name of ["ExamplesPanel", "PreviewPanel", "SettingsPanel", "SourceEditor", "Toolbar"]) {
    imports[`./${name}.js`] = { [name]: name };
  }
  vm.runInNewContext(outputText, {
    exports, AbortController, navigator: { language: "en" },
    window: { localStorage: { getItem: key => storage.get(key) ?? null }, alert: text => alerts.push(text) },
    require(path) { assert.ok(path in imports, `unexpected import ${path}`); return imports[path]; },
  });
  function render() { cursor = 0; tree = exports.App(); }
  function find(type, node = tree) {
    if (Array.isArray(node)) return node.map(child => find(type, child)).find(Boolean);
    if (!node || typeof node !== "object") return undefined;
    return (typeof type === "function" ? type(node) : node.type === type) ? node : find(type, node.props?.children ?? null);
  }
  render();
  find("Toolbar").props.onToggleSettings();
  render();
  return {
    has: type => Boolean(find(type)),
    props: type => { const node = find(type); assert.ok(node, type); return node.props; },
    async event(type, name, ...args) {
      find(type).props[name](...args);
      // Event props intentionally discard their async promises, as in React.
      for (let i = 0; i < 30; i++) await Promise.resolve();
      render();
      assert.deepEqual(alerts, []);
    },
    downloads, audioOptions, videoOptions,
  };
}

test("fresh browser preferences use defaults and preserve a saved fractional split", () => {
  const fresh = app();
  assert.equal(fresh.props("SourceEditor").editorFontSize, 14);
  assert.equal(fresh.props("section").style["--editor-pane-percent"], "45%");
  const saved = app(undefined, { "modern-jianpu-markup-editor-pane-percent": "45.5" });
  assert.equal(saved.props("section").style["--editor-pane-percent"], "45.5%");
  for (const value of ["", " ", "NaN", "Infinity"]) {
    assert.equal(app(undefined, { "modern-jianpu-markup-editor-font-size": value }).props("SourceEditor").editorFontSize, 14);
  }
});

test("playback video receives the current score, page settings, and sound settings", async () => {
  const ui = app('title: "Video demo"\npaginate: true\n===\n1 2 3 4');
  await ui.event("SettingsPanel", "onVolumeChange", 150);
  await ui.event("Toolbar", "onExportVideo");
  assert.equal(ui.videoOptions.length, 1);
  const options = ui.videoOptions[0];
  assert.equal(options.document.header.title, "Video demo");
  assert.equal(options.renderOptions.paginate, true);
  assert.equal(options.amplitude, 1.5);
  assert.equal(options.omitInitialRests, true);
  assert.equal(options.signal.aborted, false);
  assert.deepEqual(ui.downloads, ["video"]);
  assert.equal(ui.props("Toolbar").exportingVideo, false);
});

test("loading an example closes the panel only after replacement is accepted", async () => {
  const confirm = node => node.type === "button" && node.props.className === "danger-action";
  const cancel = node => node.type === "button" && node.props.children === "cancel";
  for (const existing of ["", "1 2 3 4"]) {
    const ui = app(existing);
    await ui.event("Toolbar", "onToggleExamples");
    await ui.event("ExamplesPanel", "onSelectExample", "5 6 7 1'");
    if (existing) {
      assert.equal(ui.props("SourceEditor").source, existing);
      assert.equal(ui.has("ExamplesPanel"), true);
      await ui.event(cancel, "onClick");
      assert.equal(ui.has("ExamplesPanel"), true);
      assert.equal(ui.props("SourceEditor").source, existing);
      await ui.event("ExamplesPanel", "onSelectExample", "5 6 7 1'");
      await ui.event(confirm, "onClick");
    }
    assert.equal(ui.props("SourceEditor").source, "5 6 7 1'");
    assert.equal(ui.has("ExamplesPanel"), false);
    assert.equal(ui.props("Toolbar").isPlaying, false);
  }
});

test("header and UI page options reach preview and exports with OR semantics", async () => {
  const names = ["paginate", "pageNumbers", "measureNumbers"];
  for (let headerMask = 0; headerMask < 27; headerMask++) {
    const header = names.map((_, i) => [undefined, false, true][Math.floor(headerMask / 3 ** i) % 3]);
    for (let uiMask = 0; uiMask < 8; uiMask++) {
      const preferences = names.map((_, i) => Boolean(uiMask & (1 << i)));
      const fields = names.map((name, i) => header[i] === undefined ? "" : `${name}: ${header[i]}\n`).join("");
      const ui = app(`${fields}footer: "footer text"\n===\n1 2 3 4`);
      for (const [i, option] of ["Paginate", "PageNumbers", "MeasureNumbers"].entries()) {
        await ui.event("SettingsPanel", `on${option}Change`, preferences[i]);
      }
      const paginate = Boolean(header[0] || preferences[0]);
      const pageNumbers = Boolean(header[1] || (paginate && preferences[1]));
      const measureNumbers = Boolean(header[2] || preferences[2]);
      assert.equal(ui.props("SettingsPanel").paginate, preferences[0]);
      assert.equal(ui.props("SettingsPanel").effectivePaginate, paginate);
      const preview = ui.props("PreviewPanel").svg;
      assert.equal(preview.includes('class="page"'), paginate);
      assert.equal(preview.includes('class="page-number"'), pageNumbers);
      assert.equal(preview.includes('class="measure-number"'), measureNumbers);
      assert.ok(preview.includes("footer text"));
      await ui.event("Toolbar", "onExportSvg");
      assert.equal(ui.downloads[0], preview);
    }
  }
});

test("visual exports omit playback highlighting for combined and split pages", async () => {
  for (const split of [false, true]) {
    const ui = app("paginate: true\n===\n1 2 3 4");
    await ui.event("SettingsPanel", "onSplitPagesChange", split);
    await ui.event("Toolbar", "onPlay");
    assert.match(ui.props("PreviewPanel").svg, /class="note-item active"/);
    for (const format of ["Svg", "Png", "Pdf"]) await ui.event("Toolbar", `onExport${format}`);
    assert.equal(ui.downloads.length, 3);
    for (const svg of ui.downloads) assert.doesNotMatch(svg, /class="note-item active"/);
  }
});

test("WAV and MP3 handlers preserve the full UI master volume range", async () => {
  for (const volume of [0, 100, 150, 200]) {
    const ui = app();
    await ui.event("SettingsPanel", "onVolumeChange", volume);
    await ui.event("Toolbar", "onExportWav");
    await ui.event("Toolbar", "onExportMp3");
    assert.deepEqual(ui.audioOptions.map(options => options.amplitude), [volume / 100, volume / 100]);
  }
});
