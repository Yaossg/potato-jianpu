const LYRIC_LATIN_WIDTH = 6.5;
const LYRIC_CJK_WIDTH = 17;
const LYRIC_SPACE_WIDTH = 3.5;
const LYRIC_PUNCTUATION_WIDTH = 4;
const LYRIC_OTHER_WIDTH = 8;

export type LyricScript = "cjk" | "latin";

function isCjkCharacter(char: string): boolean {
  return /[\u2e80-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/u.test(char);
}

export function lyricScript(text: string): LyricScript | "mixed" {
  let hasCjk = false;
  let hasLatin = false;
  for (const char of text) {
    if (isCjkCharacter(char)) {
      hasCjk = true;
    } else if (/\p{Script=Latin}|\p{N}/u.test(char)) {
      hasLatin = true;
    }
  }
  if (hasCjk && hasLatin) {
    return "mixed";
  }
  return hasCjk ? "cjk" : hasLatin ? "latin" : "cjk";
}

export function lyricCharacterScript(char: string): LyricScript | undefined {
  if (isCjkCharacter(char)) {
    return "cjk";
  }
  if (/\p{Script=Latin}|\p{N}/u.test(char)) {
    return "latin";
  }
  return undefined;
}

export function lyricTextWidth(text: string): number {
  return [...text].reduce((sum, char) => {
    if (/\s/u.test(char)) {
      return sum + LYRIC_SPACE_WIDTH;
    }
    if (isCjkCharacter(char)) {
      return sum + LYRIC_CJK_WIDTH;
    }
    if (/\p{Script=Latin}|\p{N}/u.test(char)) {
      return sum + LYRIC_LATIN_WIDTH;
    }
    if (/[\p{P}\p{S}]/u.test(char)) {
      return sum + LYRIC_PUNCTUATION_WIDTH;
    }
    return sum + LYRIC_OTHER_WIDTH;
  }, 0);
}
