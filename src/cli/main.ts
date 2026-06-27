#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { exportMp3Bytes, exportWavBytes, renderPdfBytes, renderPngBytes } from "../backend/index.js";
import { parse } from "../parser/index.js";
import { exportMidiBytes } from "../player/index.js";
import { renderSvg, renderSvgPages } from "../renderer/index.js";
import type { RenderOptions } from "../renderer/index.js";

function usage(): string {
  return [
    "Usage:",
    "  jianpu validate <file> [--json]",
    "  jianpu parse <file> [--json]",
    "  jianpu export-svg <file> -o <output.svg> [--page-width <px>] [--paginate] [--page-height <px>] [--page-margin <px>] [--page-footer <text>] [--page-numbers] [--color <css>] [--background <css>]",
    "  jianpu export-png <file> -o <output.png> [--page-width <px>] [--paginate] [--page-height <px>] [--page-margin <px>] [--page-footer <text>] [--page-numbers] [--color <css>] [--background <css>]",
    "  jianpu export-pdf <file> -o <output.pdf> [--page-width <px>] [--paginate] [--page-height <px>] [--page-margin <px>] [--page-footer <text>] [--page-numbers] [--color <css>] [--background <css>]",
    "  jianpu export-midi <file> -o <output.mid> [--program <number>] [--omit-initial-rest]",
    "  jianpu export-wav <file> -o <output.wav> [--program <number>] [--sample-rate <hz>] [--amplitude <0-1>] [--omit-initial-rest]",
    "  jianpu export-mp3 <file> -o <output.mp3> [--program <number>] [--sample-rate <hz>] [--amplitude <0-1>] [--bit-rate <kbps>] [--omit-initial-rest]",
    "",
    "Implemented commands: parse, validate, export-svg, export-png, export-pdf, export-midi, export-wav, and export-mp3.",
  ].join("\n");
}

function readFlag(flags: string[], name: string): string | undefined {
  const index = flags.indexOf(name);
  return index >= 0 ? flags[index + 1] : undefined;
}

const VALUE_FLAGS = new Set([
  "-o",
  "--page-width",
  "--page-height",
  "--page-margin",
  "--page-footer",
  "--color",
  "--background",
  "--program",
  "--sample-rate",
  "--amplitude",
  "--bit-rate",
]);
const NEGATIVE_NUMBER_PATTERN = /^-\d+(?:\.\d+)?$/;

function looksLikeFlag(value: string): boolean {
  return value.startsWith("-") && !NEGATIVE_NUMBER_PATTERN.test(value);
}

function hasFlagValue(flags: string[], name: string): boolean {
  const index = flags.indexOf(name);
  const value = flags[index + 1];
  return index === -1 || (value !== undefined && !looksLikeFlag(value));
}

function validateFlagValues(flags: string[], names: string[]): string | null {
  for (const name of names) {
    if (!hasFlagValue(flags, name)) {
      return name;
    }
  }
  return null;
}

function commandFlags(command: string): Set<string> {
  switch (command) {
    case "parse":
    case "validate":
      return new Set(["--json"]);
    case "export-svg":
    case "export-png":
    case "export-pdf":
      return new Set([
        "-o",
        "--page-width",
        "--paginate",
        "--page-height",
        "--page-margin",
        "--page-footer",
        "--page-numbers",
        "--color",
        "--background",
      ]);
    case "export-midi":
      return new Set(["-o", "--program", "--omit-initial-rest"]);
    case "export-wav":
    case "export-mp3":
      return new Set(["-o", "--program", "--sample-rate", "--amplitude", "--bit-rate", "--omit-initial-rest"]);
    default:
      return new Set();
  }
}

function unknownFlag(command: string, flags: string[]): string | null {
  const allowed = commandFlags(command);
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index]!;
    if (flag.startsWith("-") && !allowed.has(flag)) {
      return flag;
    }
    if (VALUE_FLAGS.has(flag)) {
      index += 1;
    }
  }
  return null;
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

function readNonNegativeNumberFlag(flags: string[], name: string): number | undefined {
  const raw = readFlag(flags, name);
  if (raw === undefined) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : Number.NaN;
}

function readRenderOptions(flags: string[]): RenderOptions | null {
  const pageWidth = readPositiveNumberFlag(flags, "--page-width");
  if (Number.isNaN(pageWidth)) {
    console.error("error: --page-width must be a positive number");
    return null;
  }
  const pageHeight = readPositiveNumberFlag(flags, "--page-height");
  if (Number.isNaN(pageHeight)) {
    console.error("error: --page-height must be a positive number");
    return null;
  }
  const pageMargin = readNonNegativeNumberFlag(flags, "--page-margin");
  if (Number.isNaN(pageMargin)) {
    console.error("error: --page-margin must be a non-negative number");
    return null;
  }
  return {
    pageWidth,
    paginate: flags.includes("--paginate"),
    pageHeight,
    pageMargin,
    pageFooter: readFlag(flags, "--page-footer"),
    pageNumbers: flags.includes("--page-numbers") ? true : undefined,
    color: readFlag(flags, "--color"),
    background: readFlag(flags, "--background"),
  };
}

function readProgram(flags: string[]): number | null {
  const program = Number(readFlag(flags, "--program") ?? "0");
  if (!Number.isInteger(program) || program < 0 || program > 174) {
    return null;
  }
  return program;
}

async function main(argv: string[]): Promise<number> {
  const [command, file, ...flags] = argv;
  if (command === "--version" || command === "-v") {
    const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version?: string };
    console.log(manifest.version ?? "0.0.0");
    return 0;
  }
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  if (!file || !["validate", "parse", "export-svg", "export-png", "export-pdf", "export-midi", "export-wav", "export-mp3"].includes(command)) {
    console.error(usage());
    return 2;
  }

  const unknown = unknownFlag(command, flags);
  if (unknown) {
    console.error(`error: unknown option ${unknown}`);
    return 2;
  }
  const missingFlagValue = validateFlagValues(flags, [
    "-o",
    "--page-width",
    "--page-height",
    "--page-margin",
    "--page-footer",
    "--color",
    "--background",
    "--program",
    "--sample-rate",
    "--amplitude",
    "--bit-rate",
  ]);
  if (missingFlagValue) {
    console.error(`error: ${missingFlagValue} requires a value`);
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
    const renderOptions = readRenderOptions(flags);
    if (!renderOptions) {
      return 2;
    }
    await writeFile(output, renderSvg(result.value, renderOptions), "utf8");
    console.log(output);
  }

  if (command === "export-png") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-png requires -o <output.png>");
      return 2;
    }
    const renderOptions = readRenderOptions(flags);
    if (!renderOptions) {
      return 2;
    }
    const background = readFlag(flags, "--background");
    const svg = renderSvg(result.value, renderOptions);
    await writeFile(output, renderPngBytes(svg, { background }));
    console.log(output);
  }

  if (command === "export-pdf") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-pdf requires -o <output.pdf>");
      return 2;
    }
    const renderOptions = readRenderOptions(flags);
    if (!renderOptions) {
      return 2;
    }
    const pages = renderSvgPages(result.value, renderOptions);
    await writeFile(output, await renderPdfBytes(pages, { title: result.value.header.title || undefined }));
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
      console.error("error: --program must be an integer from 0 to 174");
      return 2;
    }
    await writeFile(output, exportMidiBytes(result.value, program, { omitInitialRests: flags.includes("--omit-initial-rest") }));
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
      console.error("error: --program must be an integer from 0 to 174");
      return 2;
    }
    const sampleRate = readPositiveNumberFlag(flags, "--sample-rate");
    if (Number.isNaN(sampleRate)) {
      console.error("error: --sample-rate must be a positive number");
      return 2;
    }
    const amplitude = readPositiveNumberFlag(flags, "--amplitude");
    if (Number.isNaN(amplitude) || (amplitude !== undefined && amplitude > 1)) {
      console.error("error: --amplitude must be a number greater than 0 and no more than 1");
      return 2;
    }
    await writeFile(output, exportWavBytes(result.value, { program, sampleRate, amplitude, omitInitialRests: flags.includes("--omit-initial-rest") }));
    console.log(output);
  }

  if (command === "export-mp3") {
    const output = readFlag(flags, "-o");
    if (!output) {
      console.error("error: export-mp3 requires -o <output.mp3>");
      return 2;
    }
    const program = readProgram(flags);
    if (program === null) {
      console.error("error: --program must be an integer from 0 to 174");
      return 2;
    }
    const sampleRate = readPositiveNumberFlag(flags, "--sample-rate");
    if (Number.isNaN(sampleRate)) {
      console.error("error: --sample-rate must be a positive number");
      return 2;
    }
    const amplitude = readPositiveNumberFlag(flags, "--amplitude");
    if (Number.isNaN(amplitude) || (amplitude !== undefined && amplitude > 1)) {
      console.error("error: --amplitude must be a number greater than 0 and no more than 1");
      return 2;
    }
    const bitRate = readPositiveNumberFlag(flags, "--bit-rate");
    if (Number.isNaN(bitRate)) {
      console.error("error: --bit-rate must be a positive number");
      return 2;
    }
    await writeFile(
      output,
      exportMp3Bytes(result.value, { program, sampleRate, amplitude, bitRate, omitInitialRests: flags.includes("--omit-initial-rest") }),
    );
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
