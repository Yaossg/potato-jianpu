#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { parse } from "../parser/index.js";

function usage(): string {
  return [
    "Usage:",
    "  jianpu validate <file>",
    "  jianpu parse <file> [--json]",
    "",
    "Current rewrite status: parse/validate are implemented; exports come later.",
  ].join("\n");
}

function formatDiagnostic(message: string, line?: number, column?: number): string {
  if (line === undefined || column === undefined) {
    return message;
  }
  return `${line}:${column} ${message}`;
}

async function main(argv: string[]): Promise<number> {
  const [command, file, ...flags] = argv;
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  if (!file || (command !== "validate" && command !== "parse")) {
    console.error(usage());
    return 2;
  }

  const source = await readFile(file, "utf8");
  const result = parse(source);
  const json = flags.includes("--json");

  if (command === "parse") {
    if (json) {
      console.log(JSON.stringify(result, null, 2));
    } else if (result.ok) {
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

