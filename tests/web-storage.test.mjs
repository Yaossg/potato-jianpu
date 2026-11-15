import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("../src/web/storage.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });

function reader(values = {}, { readFails = false, writeFails = false } = {}) {
  const data = new Map(Object.entries(values));
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    window: { localStorage: {
      getItem(key) {
        if (readFails) throw new Error("Storage unavailable");
        return data.get(key) ?? null;
      },
      setItem(key, value) {
        if (writeFails) throw new Error("Storage full");
        data.set(key, value);
      },
    } },
  });
  return { read: exports.readStoredValue, data };
}

test("legacy drafts and all preferences migrate without deleting the originals", () => {
  const values = {
    source: "1 2 3 4", language: "zh", theme: "dark", "source-wrap": "false",
    "editor-font-size": "18", "show-line-numbers": "false",
    "highlight-current-line": "false", "highlight-diagnostics": "false",
    "editor-pane-percent": "45.5",
  };
  const { read, data } = reader(Object.fromEntries(Object.entries(values).map(([key, value]) => [`modern-jianpu-markup-${key}`, value])));
  for (const [key, value] of Object.entries(values)) {
    assert.equal(read(`potato-jianpu-${key}`), value);
    assert.equal(data.get(`potato-jianpu-${key}`), value);
    assert.equal(data.get(`modern-jianpu-markup-${key}`), value);
  }
});

test("newer and intentionally cleared drafts take precedence over legacy drafts", () => {
  for (const source of ["5 6 7", ""]) {
    const { read } = reader({ "potato-jianpu-source": source, "modern-jianpu-markup-source": "1 2 3" });
    assert.equal(read("potato-jianpu-source"), source);
  }
});

test("failed migration writes still restore the legacy draft and can be retried", () => {
  const { read, data } = reader({ "modern-jianpu-markup-source": "1 2" }, { writeFails: true });
  assert.equal(read("potato-jianpu-source"), "1 2");
  assert.equal(data.has("potato-jianpu-source"), false);
  assert.equal(data.get("modern-jianpu-markup-source"), "1 2");
});

test("missing or inaccessible storage falls back safely", () => {
  assert.equal(reader().read("potato-jianpu-source"), null);
  assert.equal(reader({}, { readFails: true }).read("potato-jianpu-source"), null);
});
