import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";
const source = await readFile(new URL("../src/web/soundfont.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
});
function loader(fetch) {
  const exports = {};
  let now = 0;
  vm.runInNewContext(outputText, {
    exports, fetch, Uint8Array,
    performance: { now: () => now += 200 },
    require: () => ({ default: "/bank.sf2" }),
  });
  return exports;
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

test("streams download progress and shares one request across concurrent consumers and cached reuse", async () => {
  let requests = 0, controller;
  const response = new Response(new ReadableStream({ start(c) { controller = c; } }), { headers: { "Content-Length": "4" } });
  const api = loader(async () => { requests++; return response; });
  const first = [], second = [];
  const a = api.loadSoundfont(s => first.push(s));
  await flush();
  controller.enqueue(new Uint8Array([1, 2]));
  await flush();
  const b = api.loadSoundfont(s => second.push(s));
  assert.equal(second[0].loaded, 2);
  assert.equal(second[0].total, 4);
  controller.enqueue(new Uint8Array([3, 4]));
  controller.close();
  const [ab, bb] = await Promise.all([a, b]);
  assert.equal(ab, bb);
  assert.deepEqual([...new Uint8Array(ab)], [1, 2, 3, 4]);
  assert.equal(first.at(-2).loaded, 4);
  assert.equal(first.at(-1), null);
  assert.equal(await api.loadSoundfont(), ab);
  assert.equal(requests, 1);
});

for (const headers of [{}, { "Content-Length": "2", "Content-Encoding": "gzip" }, { "Content-Length": "1" }]) {
  test(`does not invent a percentage with missing or unreliable total ${JSON.stringify(headers)}`, async () => {
    const states = [];
    const api = loader(async () => new Response(new Uint8Array([1, 2, 3]), { headers }));
    await api.loadSoundfont(s => states.push(s));
    assert.equal(states.at(-2).loaded, 3);
    assert.equal(states.at(-2).total, undefined);
    assert.equal(states.at(-1), null);
  });
}

test("HTTP and stream failures clear progress and allow retry", async () => {
  let attempts = 0;
  const states = [];
  const api = loader(async () => {
    attempts++;
    if (attempts === 1) return new Response(null, { status: 503 });
    if (attempts === 2) return new Response(new ReadableStream({ start(c) { c.error(new Error("disconnected")); } }));
    return new Response(new Uint8Array([9]));
  });
  await assert.rejects(api.loadSoundfont(s => states.push(s)), /503/);
  assert.equal(states.at(-1), null);
  await assert.rejects(api.loadSoundfont(s => states.push(s)), /disconnected/);
  assert.equal(states.at(-1), null);
  assert.deepEqual([...new Uint8Array(await api.loadSoundfont())], [9]);
});

test("unsubscribing stops progress notifications without aborting a shared download", async () => {
  let controller;
  const api = loader(async () => new Response(new ReadableStream({ start(c) { controller = c; } })));
  const statuses = [];
  const unsubscribe = api.subscribeSoundfontProgress(s => statuses.push(s));
  const loading = api.loadSoundfont();
  await flush();
  unsubscribe();
  const count = statuses.length;
  controller.enqueue(new Uint8Array([4]));
  controller.close();
  await loading;
  assert.equal(statuses.length, count);
});
