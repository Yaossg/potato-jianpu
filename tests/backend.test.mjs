import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import { renderSvg } from "../dist/renderer/index.js";
import { renderPngBytes } from "../dist/backend/index.js";

test("renders SVG output to PNG bytes", () => {
  const result = parse(`title: "PNG"\n=\n1 2 3 4 | 5 - |`);
  assert.equal(result.ok, true);
  const png = renderPngBytes(renderSvg(result.value));
  assert.deepEqual([...png.slice(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.ok(png.length > 100);
});

