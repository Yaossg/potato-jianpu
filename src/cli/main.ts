#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { exportWavBytes, renderPngBytes } from "../backend/index.js";
import { parse } from "../parser/index.js";
import { exportMidiBytes } from "../player/index.js";
import { renderSvg } from "../renderer/index.js";

function usage(): string {
  return [
    "Usage:",
    "  jianpu validate <file> [--json]",
    "  jianpu parse <file> [--json]",
    "  jianpu export-svg <file> -o <output.svg> [--page-width <px>]",
    "  jianpu export-png <file> -o <output.png> [--page-width <px>]",
    "  jianpu export-midi <file> -o <output.mid> [--program <number>]",
    "  jianpu export-wav <file> -o <output.wav> [--program <number>] [--sample-rate <hz>]",
    "",
    "Current rewrite status: parse/validate/export-svg/export-png/export-midi are implemented.",
  ].join("\n");
}

function readFlag(flags: string[], name: string): string | undefined {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
}

function formatDiagnostic(message: string, line?: number, column?: number): string {
  if (line === undefined || column === undefined) {
    return message;
  }
  return `${line}:${column} ${message}`;
}

function readPositiveNumberFlag(flags: string[], name: string): number | undefined {
  const raw = readFlag(flags, name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : Number.NaN;
}

function readProgram(flags: string[]): number | null {
  const program = Number(readFlag(flags, "--program") ?? "0");
  if (!Number.isInteger(program) || program < 0 || program > 220) {
    return null;
  }
  return program;
}

async function main(argv: string[]): Promise<number> {
  const [command, file, ...flags] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  if (!file || !["validate", "parse", "export-svg", "export-png", "export-midi", "export-wav"].includes(command)) {
    console.error(usage());
    return 2;
  }

  const source = await readFile(file, "utf8");
  const result = parse(source);
  const json = flags.includes("--json");

  if (json && (command === "parse" || command === "validate")) {
    console.log(JSON.stringify(command === "parse" ? result : { ok: result.ok, diagnostics: result.diagnostics }, null, 2));
    return result.ok ? 0 : 1;
  }

  if (command === "parse") {
    if (result.ok) {
      console.log(`Parsed ${result.value.score.length} score line(s).`);
    }
  }

  for (const diagnostic of result.diagnostics) {
    const line = diagnostic.range?.start.line;
    const column = diagnostic.range?.start.column;
    const formatted = formatDiagnostic(diagnostic.message, line, column);
    if (diagnostic.severity === "error") {
      console.error(`error: ${formatted}`);
    } else {
      console.warn(`warning: ${formatted}`);
    }
  }

  if (!result.ok) {
    return 1;
  }

  if (command === "export-svg") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-svg requires -o <output.svg>");
      return 2;
    }
    const pageWidth = readPositiveNumberFlag(flags, "--page-width");
    if (Number.isNaN(pageWidth)) {
      console.error("error: --page-width must be a positive number");
      return 2;
    }
    await writeFile(output, pageWidth === undefined ? renderSvg(result.value) : renderSvg(result.value, { pageWidth }), "utf8");
    console.log(output);
  }

  if (command === "export-png") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-png requires -o <output.png>");
      return 2;
    }
    const pageWidth = readPositiveNumberFlag(flags, "--page-width");
    if (Number.isNaN(pageWidth)) {
      console.error("error: --page-width must be a positive number");
      return 2;
    }
    const svg = pageWidth === undefined ? renderSvg(result.value) : renderSvg(result.value, { pageWidth });
    await writeFile(output, renderPngBytes(svg));
    console.log(output);
  }

  if (command === "export-midi") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-midi requires -o <output.mid>");
      return 2;
    }
    const program = readProgram(flags);
    if (program === null) {
      console.error("error: --program must be an integer from 0 to 220");
      return 2;
    }
    await writeFile(output, exportMidiBytes(result.value, program));
    console.log(output);
  }

  if (command === "export-wav") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-wav requires -o <output.wav>");
      return 2;
    }
    const program = readProgram(flags);
    if (program === null) {
      console.error("error: --program must be an integer from 0 to 220");
      return 2;
    }
    const sampleRate = readPositiveNumberFlag(flags, "--sample-rate");
    if (Number.isNaN(sampleRate)) {
      console.error("error: --sample-rate must be a positive number");
      return 2;
    }
    await writeFile(output, exportWavBytes(result.value, { program, sampleRate }));
    console.log(output);
  }

  if (command === "validate") {
    console.log("OK");
  }
  return 0;
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
