import scale from "../../examples/scale.jpu?raw";
import twinkle from "../../examples/twinkle.jpu?raw";
import odeToJoy from "../../examples/ode-to-joy.jpu?raw";
import _68example from "../../examples/6-8-example.jpu?raw";
import drums from "../../examples/drums.jpu?raw";
import jingleBells from "../../examples/jingle-bells.jpu?raw";
import happyBirthday from "../../examples/happy-birthday.jpu?raw";
import edelweiss from "../../examples/edelweiss.jpu?raw";
import canon from "../../examples/canon.jpu?raw";
import dearLittleWish from "../../examples/dear-little-wish.jpu?raw";
import burningField from "../../examples/burning-field.jpu?raw";
import blockyHeroes from "../../examples/blocky-heroes.jpu?raw";
import shining from "../../examples/shining-from-the-underground.jpu?raw";
import theSameSong from "../../examples/the-same-song.jpu?raw";
import sunnySkips from "../../examples/sunny-skips.jpu?raw";

export const examples = [
  scale,
  twinkle,
  odeToJoy,
  _68example,
  drums,
  jingleBells,
  happyBirthday,
  edelweiss,
  canon,
  dearLittleWish,
  burningField,
  blockyHeroes,
  shining,
  theSameSong,
  sunnySkips,
];

export function exampleTitle(source: string): string | null {
  return headerField(source, "title");
}

export function exampleName(source: string, language: "en" | "zh"): string {
  const title = headerField(source, "title");
  const subtitle = headerField(source, "subtitle");
  if (language === "en") {
    return title ?? subtitle ?? "Untitled example";
  }
  if (title && hasChineseText(title)) {
    return title;
  }
  if (subtitle && hasChineseText(subtitle)) {
    return subtitle;
  }
  return title ?? subtitle ?? "Untitled example";
}

function headerField(source: string, field: "title" | "subtitle"): string | null {
  const match = source.match(new RegExp(`^${field}:\\s*"([^"]*)"`, "m"));
  return match?.[1] ?? null;
}

function hasChineseText(text: string): boolean {
  return /[\u3400-\u9fff]/.test(text);
}
