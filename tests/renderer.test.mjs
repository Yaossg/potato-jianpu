import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import { renderSvg } from "../dist/renderer/index.js";

test("renders a parse result as an SVG document", () => {
  const result = parse(`title: "Render Test"\nkey: "F#"\n=\n1 #4/ 5-|`);
  assert.equal(result.ok, true);
  const svg = renderSvg(result.value, { pageWidth: 640 });
  assert.match(svg, /^<\?xml/);
  assert.match(svg, /<svg[^>]+width="640"/);
  assert.match(svg, /Render Test/);
  assert.match(svg, /1=F♯/);
  assert.match(svg, /♯/);
  assert.match(svg, /class="dash"/);
  assert.match(svg, /font-family: Arial, Helvetica, sans-serif/);
});
