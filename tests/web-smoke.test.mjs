import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoDir = fileURLToPath(new URL("../", import.meta.url));

async function runPnpmScript(script) {
  if (process.env.npm_execpath) {
    await execFileAsync(process.execPath, [process.env.npm_execpath, "run", script], { cwd: repoDir });
    return;
  }
  await execFileAsync("pnpm", ["run", script], { cwd: repoDir });
}

test("frontend production build emits the expected app shell", async () => {
  await runPnpmScript("web:build");

  const html = await readFile(new URL("../dist-web/index.html", import.meta.url), "utf8");
  assert.match(html, /<div id="root"><\/div>/);

  const scriptPath = html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
  const stylePath = html.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
  assert.ok(scriptPath);
  assert.ok(stylePath);

  const script = await readFile(new URL(`../dist-web/${scriptPath.replace(/^\//, "")}`, import.meta.url), "utf8");
  const style = await readFile(new URL(`../dist-web/${stylePath.replace(/^\//, "")}`, import.meta.url), "utf8");
  const grammar = await readFile(new URL("../dist-web/grammar.html", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../src/web/App.tsx", import.meta.url), "utf8");
  const audioSource = await readFile(new URL("../src/web/audio.ts", import.meta.url), "utf8");

  assert.match(script, /Modern Jianpu Markup/);
  assert.match(script, /Export/);
  assert.doesNotMatch(script, /Export SVG/);
  assert.doesNotMatch(script, /Export PNG/);
  assert.doesNotMatch(script, /Export MIDI/);
  assert.match(script, /jianpu-score\.svg/);
  assert.match(script, /jianpu-score\.png/);
  assert.match(script, /jianpu-score\.mid/);
  assert.match(script, /jianpu-score\.wav/);
  assert.match(script, /jianpu-score\.mp3/);
  assert.match(script, /image\/png/);
  assert.match(script, /audio\/wav/);
  assert.match(script, /audio\/mpeg/);
  assert.match(script, /Rendering locally/);
  assert.match(script, /events/);
  assert.match(script, /Theme/);
  assert.match(script, /Settings/);
  assert.match(script, /Page Settings/);
  assert.match(script, /Width mode/);
  assert.match(script, /Content/);
  assert.match(script, /Justify/);
  assert.match(script, /Except last line/);
  assert.match(script, /All lines/);
  assert.match(script, /ResizeObserver/);
  assert.match(script, /Sound Settings/);
  assert.match(script, /modern-jianpu-markup-theme/);
  assert.match(script, /prefers-color-scheme: dark/);
  assert.match(script, /Help/);
  assert.match(script, /grammar\.html/);
  assert.match(script, /Examples/);
  assert.match(script, /Enter your Jianpu here/);
  assert.doesNotMatch(script, /Grammar Reference/);
  assert.match(script, /General MIDI/);
  assert.match(script, /Volume/);
  assert.match(script, /max:200/);
  assert.match(script, /Audio sample rate/);
  assert.match(script, /Audition/);
  assert.match(script, /internalcontext/);
  assert.match(script, /Omit initial rests/);
  assert.match(style, /font-variant-ligatures:\s*none/);
  assert.match(style, /\.theme-dark/);
  assert.match(style, /\.export-menu/);
  assert.match(style, /\.export-menu-items/);
  assert.match(style, /\.export-status/);
  assert.match(style, /\.settings-panel/);
  assert.match(style, /\.settings-section\s*\+\s*\.settings-section/);
  assert.match(style, /\.settings-grid/);
  assert.match(style, /\.examples-panel/);
  assert.match(style, /\.examples-grid/);
  assert.doesNotMatch(style, /\.grammar-panel/);
  assert.match(style, /--app-bg:/);
  assert.match(style, /\.score-svg svg\{/);
  assert.match(style, /max-width:100%/);
  assert.match(style, /height:auto/);
  assert.match(style, /\.preview-panel/);
  assert.match(grammar, /Modern Jianpu Markup Grammar Reference/);
  assert.match(grammar, /class="railroad-diagram"/);
  assert.match(grammar, /durable_note ::= tie\? general_note length\?/);
  assert.match(grammar, /IDENTIFIER ::=/);
  assert.match(grammar, /Reference/);
  assert.match(grammar, /Whitespace And Comments/);
  assert.match(grammar, />5\. Key</);
  assert.match(grammar, />6\. Time</);
  assert.match(grammar, />7\. Tempo</);
  assert.match(grammar, /Token Reference/);
  assert.ok(grammar.indexOf("<h2>Reference</h2>") < grammar.indexOf("<h2>Railroad And EBNF</h2>"));
  assert.match(appSource, /function updateSource/);
  assert.match(appSource, /onChange=\{\(event\) => updateSource\(event\.target\.value\)\}/);
  assert.match(appSource, /inferContentPageWidth/);
  assert.match(audioSource, /SCHEDULE_AHEAD_SECONDS/);
  assert.match(audioSource, /currentTime > context\.currentTime \+ SCHEDULE_AHEAD_SECONDS/);
  assert.match(script, /grammar\.zh\.html/);
  assert.match(script, /time-signature/);
  assert.match(script, /帮助/);
});
