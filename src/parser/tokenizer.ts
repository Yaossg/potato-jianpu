import type { Diagnostic, SourcePosition, SourceRange } from "../core/index.js";

export type TokenType =
  | "identifier"
  | "string"
  | "autoString"
  | "note"
  | "digit"
  | "rest"
  | "drum"
  | "bar"
  | "repeatStart"
  | "repeatEnd"
  | "repeatBoth"
  | "sharpsharp"
  | "sharp"
  | "flatflat"
  | "flat"
  | "natural"
  | "half"
  | "dot"
  | "dash"
  | "lower"
  | "higher"
  | "tie"
  | "equals"
  | "colon"
  | "lbrace"
  | "rbrace"
  | "lparen"
  | "rparen"
  | "lbracket"
  | "rbracket"
  | "caret"
  | "velocity"
  | "crescendo"
  | "diminuendo"
  | "newline"
  | "eof";

export interface Token {
  type: TokenType;
  text: string;
  value?: string;
  range: SourceRange;
}

function clonePosition(position: SourcePosition): SourcePosition {
  return { ...position };
}

function rangeFrom(start: SourcePosition, end: SourcePosition): SourceRange {
  return { start: clonePosition(start), end: clonePosition(end) };
}

function advance(position: SourcePosition, text: string): SourcePosition {
  let next = clonePosition(position);
  for (const char of text) {
    next.offset += char.length;
    if (char === "\n") {
      next.line += 1;
      next.column = 1;
    } else {
      next.column += 1;
    }
  }
  return next;
}

export function tokenize(source: string): { tokens: Token[]; diagnostics: Diagnostic[] } {
  const tokens: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  let pos: SourcePosition = { offset: 0, line: 1, column: 1 };

  function push(type: TokenType, text: string, value?: string) {
    const start = clonePosition(pos);
    pos = advance(pos, text);
    tokens.push({ type, text, value, range: rangeFrom(start, pos) });
  }

  while (pos.offset < source.length) {
    const rest = source.slice(pos.offset);
    const char = rest[0]!;

    if (char === " " || char === "\t") {
      pos = advance(pos, char);
      continue;
    }

    if (char === "\r") {
      if (rest.startsWith("\r\n")) {
        push("newline", "\r\n");
      } else {
        push("newline", "\r");
      }
      continue;
    }

    if (char === "\n") {
      push("newline", "\n");
      continue;
    }

    if (char === ";") {
      const end = rest.search(/\r|\n/);
      const comment = end === -1 ? rest : rest.slice(0, end);
      pos = advance(pos, comment);
      continue;
    }

    if (char === "@" && rest[1] === "\"") {
      const start = clonePosition(pos);
      let i = 2;
      let closed = false;
      while (i < rest.length) {
        const current = rest[i]!;
        if (current === "\r" || current === "\n") {
          break;
        }
        if (current === "\\") {
          i += 2;
          continue;
        }
        if (current === "\"") {
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      const text = rest.slice(0, i);
      pos = advance(pos, text);
      if (closed) {
        tokens.push({
          type: "autoString",
          text,
          value: text.slice(2, -1),
          range: rangeFrom(start, pos),
        });
      } else {
        diagnostics.push({
          severity: "error",
          message: "Unterminated string literal.",
          range: rangeFrom(start, pos),
        });
      }
      continue;
    }

    if (char === "\"") {
      const start = clonePosition(pos);
      let i = 1;
      let closed = false;
      while (i < rest.length) {
        const current = rest[i]!;
        if (current === "\r" || current === "\n") {
          break;
        }
        if (current === "\\") {
          i += 2;
          continue;
        }
        if (current === "\"") {
          i += 1;
          closed = true;
          break;
        }
        i += 1;
      }
      const text = rest.slice(0, i);
      pos = advance(pos, text);
      if (closed) {
        tokens.push({
          type: "string",
          text,
          value: text.slice(1, -1),
          range: rangeFrom(start, pos),
        });
      } else {
        diagnostics.push({
          severity: "error",
          message: "Unterminated string literal.",
          range: rangeFrom(start, pos),
        });
      }
      continue;
    }

    const numberedLabel = /^[TL]\d+(?=:)/.exec(rest)?.[0];
    if (numberedLabel) {
      push("identifier", numberedLabel, numberedLabel);
      continue;
    }

    const labeledIdentifier = /^[A-Za-z][A-Za-z0-9_]*(?=:)/.exec(rest)?.[0];
    if (labeledIdentifier) {
      push("identifier", labeledIdentifier, labeledIdentifier);
      continue;
    }

    if (rest.startsWith("bb") && /^[1-7]/.test(rest[2] ?? "")) {
      push("flatflat", "bb");
      continue;
    }
    if (rest.startsWith("b") && /^[1-7]/.test(rest[1] ?? "")) {
      push("flat", "b");
      continue;
    }
    if (rest.startsWith("X")) {
      push("drum", "X");
      continue;
    }

    const velocityMatch = /^(ppp|pp|mp|mf|fff|ff|p|f)/.exec(rest)?.[0];
    if (velocityMatch) {
      push("velocity", velocityMatch);
      continue;
    }

    const word = /^[A-Za-z][A-Za-z0-9_]*/.exec(rest)?.[0];
    if (word) {
      push("identifier", word, word);
      continue;
    }

    if (/^[1-7]$/.test(char)) {
      push("note", char, char);
      continue;
    }

    if (/^[89]$/.test(char)) {
      push("digit", char, char);
      continue;
    }

    const three = rest.slice(0, 3);
    if (three === ":|:") {
      push("repeatBoth", three);
      continue;
    }

    const two = rest.slice(0, 2);
    if (two === "|:") {
      push("repeatStart", two);
      continue;
    }
    if (two === ":|") {
      push("repeatEnd", two);
      continue;
    }
    if (two === "##") {
      push("sharpsharp", two);
      continue;
    }

    switch (char) {
      case "0":
        push("rest", char);
        break;
      case "|":
        push("bar", char);
        break;
      case "#":
        push("sharp", char);
        break;
      case "%":
        push("natural", char);
        break;
      case "/":
        push("half", char);
        break;
      case ".":
        push("dot", char);
        break;
      case "-":
        push("dash", char);
        break;
      case ",":
        push("lower", char);
        break;
      case "'":
        push("higher", char);
        break;
      case "~":
        push("tie", char);
        break;
      case "<":
        push("crescendo", char);
        break;
      case ">":
        push("diminuendo", char);
        break;
      case "=":
        push("equals", char);
        break;
      case ":":
        push("colon", char);
        break;
      case "{":
        push("lbrace", char);
        break;
      case "}":
        push("rbrace", char);
        break;
      case "(":
        push("lparen", char);
        break;
      case ")":
        push("rparen", char);
        break;
      case "[":
        push("lbracket", char);
        break;
      case "]":
        push("rbracket", char);
        break;
      case "^":
        push("caret", char);
        break;
      default: {
        const start = clonePosition(pos);
        pos = advance(pos, char);
        diagnostics.push({
          severity: "error",
          message: `Unexpected character '${char}'.`,
          range: rangeFrom(start, pos),
        });
      }
    }
  }

  const eof = clonePosition(pos);
  tokens.push({ type: "eof", text: "", range: rangeFrom(eof, eof) });
  return { tokens, diagnostics };
}
