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

  assert.match(script, /Modern Jianpu Reloaded/);
  assert.match(script, /Export SVG/);
  assert.match(script, /Export MIDI/);
  assert.match(script, /General MIDI/);
  assert.match(script, /Volume/);
  assert.doesNotMatch(script, /Export PNG|Export WAV|Export MP3/);
  assert.match(style, /font-variant-ligatures:\s*none/);
  assert.match(style, /\.preview-panel/);
});
