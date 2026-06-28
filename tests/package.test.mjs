import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = fileURLToPath(new URL("../", import.meta.url));

async function exists(path) {
  await access(join(repoDir, path));
}

test("package metadata points at built backend and library files", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(manifest.type, "module");
  assert.equal(manifest.private, true);
  assert.equal(manifest.packageManager, "pnpm@8.10.3");
  assert.equal(manifest.main, "./dist/index.js");
  assert.equal(manifest.types, "./dist/index.d.ts");
  assert.equal(manifest.bin.jianpu, "./dist/cli/main.js");
  assert.ok(manifest.files.includes("dist/"));
  assert.ok(manifest.files.includes("dist-web/"));
  assert.ok(!manifest.files.includes("docs-site/"));
  assert.ok(manifest.files.includes("docs-site/package.json"));
  assert.ok(manifest.files.includes("docs-site/src/"));

  await exists(manifest.main);
  await exists(manifest.types);
  await exists(manifest.bin.jianpu);
  await assert.rejects(access(join(repoDir, "dist/web")));

  for (const [name, target] of Object.entries(manifest.exports)) {
    if (typeof target === "string") {
      await exists(target);
      continue;
    }
    assert.ok(target.import, `${name} export should define import`);
    assert.ok(target.types, `${name} export should define types`);
    await exists(target.import);
    await exists(target.types);
  }
});
