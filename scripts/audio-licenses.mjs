import { readFileSync } from "node:fs";

export function audioLicenses() {
  return {
    name: "audio-licenses",
    generateBundle() {
      for (const [fileName, path] of [
        ["GeneralUser-GS-LICENSE.txt", "../assets/soundfonts/LICENSE.txt"],
        ["GeneralUser-GS-README.md", "../assets/soundfonts/README.md"],
        ["SpessaSynth-LICENSE.txt", "../node_modules/spessasynth_core/LICENSE"],
      ]) {
        this.emitFile({ type: "asset", fileName: `licenses/${fileName}`, source: readFileSync(new URL(path, import.meta.url), "utf8") });
      }
    },
  };
}
