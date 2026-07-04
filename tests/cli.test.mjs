import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const repoDir = fileURLToPath(new URL("../", import.meta.url));

function pngDimensions(png) {
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

test("CLI prints package version", async () => {
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const { stdout, stderr } = await execFileAsync(process.execPath, ["dist/cli/main.js", "--version"], {
    cwd: repoDir,
  });

  assert.equal(stderr, "");
  assert.equal(stdout.trim(), manifest.version);
});

test("CLI prints usage help", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, ["dist/cli/main.js", "--help"], {
    cwd: repoDir,
  });

  assert.equal(stderr, "");
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /export-svg/);
  assert.match(stdout, /export-pdf/);
  assert.match(stdout, /export-wav/);
  assert.match(stdout, /export-mp3/);
});

test("CLI export-svg accepts page width", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "120"], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  assert.match(svg, /<svg[^>]+width="120"/);
});

test("CLI export-svg embeds Bravura for SMuFL ornaments", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1(^) 2(v)", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  assert.match(svg, /@font-face \{ font-family: Bravura;/);
  assert.match(svg, /data:font\/woff2;base64,/);
  assert.match(svg, /class="ornament mordent smufl-symbol"/);
});

test("CLI export-svg can paginate with explicit page height", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "120", "--paginate", "--page-height", "160"], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  const pageCount = [...svg.matchAll(/<g class="page" data-page="/g)].length;
  assert.ok(pageCount > 1);
  assert.match(svg, new RegExp(`<svg[^>]+height="${pageCount * 160}"`));
  assert.equal([...svg.matchAll(/<rect class="page-boundary"/g)].length, pageCount);
});

test("CLI export-svg uses pagination from header", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "paginate: true\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "120", "--page-height", "160"], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  const pageCount = [...svg.matchAll(/<g class="page" data-page="/g)].length;
  assert.ok(pageCount > 1);
  assert.match(svg, new RegExp(`<svg[^>]+height="${pageCount * 160}"`));
});

test("CLI export-svg accepts page margin", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 | 3 4 |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "160", "--page-margin", "20"], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  assert.match(svg, /<svg[^>]+width="160"/);
  assert.match(svg, /<g class="page-content" transform="translate\(20, 20\)">/);
});

test("CLI export-svg accepts paper presets and orientation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  const overriddenOutput = join(dir, "score-custom.svg");
  await writeFile(input, "1 2 | 3 4 |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--paper", "b5", "--orientation", "landscape", "--paginate"], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  assert.match(svg, /<svg[^>]+width="1418" height="998" viewBox="0 0 1418 998"/);
  assert.match(svg, /<rect class="page-boundary" x="0\.5" y="0\.5" width="1417" height="997"/);

  await execFileAsync(
    process.execPath,
    [
      "dist/cli/main.js",
      "export-svg",
      input,
      "-o",
      overriddenOutput,
      "--paper",
      "a4",
      "--orientation",
      "landscape",
      "--page-width",
      "700",
      "--page-height",
      "900",
      "--paginate",
    ],
    {
      cwd: repoDir,
    },
  );

  const overriddenSvg = await readFile(overriddenOutput, "utf8");
  assert.match(overriddenSvg, /<svg[^>]+width="700" height="900" viewBox="0 0 700 900"/);
});

test("CLI export-png accepts pagination options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.png");
  await writeFile(input, "1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-png", input, "-o", output, "--page-width", "120", "--paginate", "--page-height", "160"], {
    cwd: repoDir,
  });

  const png = await readFile(output);
  assert.equal(String.fromCharCode(...png.slice(1, 4)), "PNG");
});

test("CLI export-svg can split rendered pages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 | 3 4 |\n---\n5 6 | 7 1' |", "utf8");

  const { stdout } = await execFileAsync(
    process.execPath,
    ["dist/cli/main.js", "export-svg", input, "-o", output, "--paginate", "--page-width", "160", "--page-height", "180", "--split-pages"],
    {
      cwd: repoDir,
    },
  );

  const paths = stdout.trim().split(/\r?\n/);
  assert.deepEqual(paths, [join(dir, "score-01.svg"), join(dir, "score-02.svg")]);
  await assert.rejects(readFile(output, "utf8"), /ENOENT/);
  const firstPage = await readFile(paths[0], "utf8");
  const secondPage = await readFile(paths[1], "utf8");
  assert.match(firstPage, /<svg[^>]+width="160" height="180"/);
  assert.match(firstPage, /data-page="1"/);
  assert.doesNotMatch(firstPage, /data-page="2"/);
  assert.match(secondPage, /data-page="2"/);
});

test("CLI export-png can split rendered pages", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.png");
  await writeFile(input, "1 2 | 3 4 |\n---\n5 6 | 7 1' |", "utf8");

  const { stdout } = await execFileAsync(
    process.execPath,
    ["dist/cli/main.js", "export-png", input, "-o", output, "--paper", "letter", "--orientation", "landscape", "--paginate", "--split-pages"],
    {
      cwd: repoDir,
    },
  );

  const paths = stdout.trim().split(/\r?\n/);
  assert.deepEqual(paths, [join(dir, "score-01.png"), join(dir, "score-02.png")]);
  assert.deepEqual(pngDimensions(await readFile(paths[0])), { width: 1584, height: 1224 });
  assert.deepEqual(pngDimensions(await readFile(paths[1])), { width: 1584, height: 1224 });
});

test("CLI export-pdf accepts pagination options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.pdf");
  await writeFile(input, "1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-pdf", input, "-o", output, "--page-width", "120", "--paginate", "--page-height", "160"], {
    cwd: repoDir,
  });

  const pdf = await readFile(output);
  assert.equal(String.fromCharCode(...pdf.slice(0, 4)), "%PDF");
  const text = pdf.toString("latin1");
  assert.ok([...text.matchAll(/\/Type\s*\/Page\b/g)].length > 1);
});

test("CLI export-svg accepts explicit color and background", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await execFileAsync(
    process.execPath,
    ["dist/cli/main.js", "export-svg", input, "-o", output, "--color", "#123456", "--background", "#f8fafc"],
    {
      cwd: repoDir,
    },
  );

  const svg = await readFile(output, "utf8");
  assert.match(svg, /style="color: #123456"/);
  assert.match(svg, /fill="#f8fafc"/);
});

test("CLI export-svg accepts page footer and number options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(
    process.execPath,
    [
      "dist/cli/main.js",
      "export-svg",
      input,
      "-o",
      output,
      "--page-width",
      "140",
      "--paginate",
      "--page-height",
      "160",
      "--page-margin",
      "20",
      "--page-footer",
      "modern-jianpu",
      "--page-numbers",
    ],
    {
      cwd: repoDir,
    },
  );

  const svg = await readFile(output, "utf8");
  assert.match(svg, /<text class="page-footer"[^>]*>modern-jianpu<\/text>/);
  assert.match(svg, /<text class="page-number"[^>]*>1 \/ \d+<\/text>/);
});

test("CLI export-svg uses page footer and numbers from header", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, `footer: "from-header"\nnumbering: true\n===\n1 2 | 3 4 | 5 6 | 7 1' |\n1 2 | 3 4 | 5 6 | 7 1' |`, "utf8");

  await execFileAsync(
    process.execPath,
    ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "140", "--paginate", "--page-height", "160", "--page-margin", "20"],
    {
      cwd: repoDir,
    },
  );

  const svg = await readFile(output, "utf8");
  assert.match(svg, /<text class="page-footer"[^>]*>from-header<\/text>/);
  assert.match(svg, /<text class="page-number"[^>]*>1 \/ \d+<\/text>/);
});

test("CLI export-svg succeeds with warnings", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, `time: 4/4\n===\n1 2`, "utf8");

  const { stdout, stderr } = await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output], {
    cwd: repoDir,
  });

  assert.match(stdout.trim(), /score\.svg$/);
  assert.match(stderr, /warning:/);
  assert.match(stderr, /Measure duration/);
  const svg = await readFile(output, "utf8");
  assert.match(svg, /<svg/);
});


test("CLI rejects invalid page width", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "0"], {
      cwd: repoDir,
    }),
    /--page-width must be a positive number/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "-1"], {
      cwd: repoDir,
    }),
    /--page-width must be a positive number/,
  );
});

test("CLI rejects invalid paper options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--paper", "b4"], {
      cwd: repoDir,
    }),
    /--paper must be one of a4, b5, letter/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--orientation", "sideways"], {
      cwd: repoDir,
    }),
    /--orientation must be portrait or landscape/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--paper"], {
      cwd: repoDir,
    }),
    /--paper requires a value/,
  );
});

test("CLI split page export does not overwrite existing page files", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  const existingPage = join(dir, "score-01.svg");
  await writeFile(input, "1 2 | 3 4 |\n---\n5 6 | 7 1' |", "utf8");
  await writeFile(existingPage, "existing", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--paginate", "--split-pages"], {
      cwd: repoDir,
    }),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(String(error.stderr), /output file already exists: .*score-01\.svg/);
      return true;
    },
  );

  assert.equal(await readFile(existingPage, "utf8"), "existing");
});

test("CLI rejects invalid page margin", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-margin", "-1"], {
      cwd: repoDir,
    }),
    /--page-margin must be a non-negative number/,
  );
});

test("CLI export-pdf requires output and validates page dimensions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.pdf");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-pdf", input], {
      cwd: repoDir,
    }),
    /export-pdf requires -o <output\.pdf>/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-pdf", input, "-o", output, "--page-height", "0"], {
      cwd: repoDir,
    }),
    /--page-height must be a positive number/,
  );
});

test("CLI rejects invalid and missing page height", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-height", "0"], {
      cwd: repoDir,
    }),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(String(error.stderr), /--page-height must be a positive number/);
      return true;
    },
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-height"], {
      cwd: repoDir,
    }),
    (error) => {
      assert.equal(error.code, 2);
      assert.match(String(error.stderr), /--page-height requires a value/);
      return true;
    },
  );
});

test("CLI rejects flags with missing values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width"], {
      cwd: repoDir,
    }),
    /--page-width requires a value/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "--color", "#123456"], {
      cwd: repoDir,
    }),
    /--page-width requires a value/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", join(dir, "score.mid"), "--program", "--omit-initial-rest"], {
      cwd: repoDir,
    }),
    /--program requires a value/,
  );
});

test("CLI rejects unknown options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--widht", "1000"], {
      cwd: repoDir,
    }),
    /unknown option --widht/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", join(dir, "score.mid"), "--json"], {
      cwd: repoDir,
    }),
    /unknown option --json/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-pdf", input, "-o", join(dir, "score.pdf"), "--split-pages"], {
      cwd: repoDir,
    }),
    /unknown option --split-pages/,
  );
});

test("CLI validates options before reading input files", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", "missing.jpu", "--widht", "1000"], {
      cwd: repoDir,
    }),
    /unknown option --widht/,
  );
});



test("CLI validate can emit machine-readable diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  await writeFile(input, "~1", "utf8");

  await assert.rejects(
    async () => {
      await execFileAsync(process.execPath, ["dist/cli/main.js", "validate", input, "--json"], {
        cwd: repoDir,
      });
    },
    (error) => {
      const stdout = String(error.stdout);
      const stderr = String(error.stderr);
      const payload = JSON.parse(stdout);
      assert.equal(stderr, "");
      assert.equal(payload.ok, false);
      assert.match(payload.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /First note cannot be tied/);
      return true;
    },
  );
});

test("CLI parse JSON keeps diagnostics machine-readable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  await writeFile(input, `time: 4/4\n===\n1 2`, "utf8");

  const { stdout, stderr } = await execFileAsync(process.execPath, ["dist/cli/main.js", "parse", input, "--json"], {
    cwd: repoDir,
  });
  const payload = JSON.parse(stdout);
  assert.equal(stderr, "");
  assert.equal(payload.ok, true);
  assert.equal(payload.diagnostics[0].severity, "warning");
  assert.match(payload.diagnostics[0].message, /Measure duration/);
});

test("CLI parse JSON keeps parse errors machine-readable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  await writeFile(input, `title: "unterminated\n===\n1 2`, "utf8");

  await assert.rejects(
    async () => {
      await execFileAsync(process.execPath, ["dist/cli/main.js", "parse", input, "--json"], {
        cwd: repoDir,
      });
    },
    (error) => {
      const stdout = String(error.stdout);
      const stderr = String(error.stderr);
      const payload = JSON.parse(stdout);
      assert.equal(stderr, "");
      assert.equal(payload.ok, false);
      assert.match(payload.diagnostics.map((diagnostic) => diagnostic.message).join("\n"), /Unterminated string literal/);
      return true;
    },
  );
});


test("CLI export-wav writes a WAV file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.wav");
  await writeFile(input, `tempo: 120\n===\n1 2 3 4`, "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-wav", input, "-o", output, "--sample-rate", "8000", "--amplitude", "0.5"], {
    cwd: repoDir,
  });

  const wav = await readFile(output);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(wav.readUInt32LE(24), 8000);
});

test("CLI export-mp3 writes an MP3 file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.mp3");
  await writeFile(input, `tempo: 120\n===\n1 2 3 4`, "utf8");

  await execFileAsync(
    process.execPath,
    ["dist/cli/main.js", "export-mp3", input, "-o", output, "--sample-rate", "44100", "--amplitude", "0.5", "--bit-rate", "64"],
    {
      cwd: repoDir,
    },
  );

  const mp3 = await readFile(output);
  const syncOffset = mp3.findIndex((byte, index) => byte === 0xff && (mp3[index + 1] & 0xe0) === 0xe0);
  assert.ok(syncOffset >= 0);
  assert.ok(mp3.length > 100);
});

test("CLI export-midi and export-wav can omit initial rests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const midiWithRests = join(dir, "with-rests.mid");
  const midiWithoutRests = join(dir, "without-rests.mid");
  const wavWithRests = join(dir, "with-rests.wav");
  const wavWithoutRests = join(dir, "without-rests.wav");
  await writeFile(input, `tempo: 120\n===\n0 0 1 2`, "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", midiWithRests], { cwd: repoDir });
  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", midiWithoutRests, "--omit-initial-rest"], {
    cwd: repoDir,
  });
  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-wav", input, "-o", wavWithRests, "--sample-rate", "8000"], {
    cwd: repoDir,
  });
  await execFileAsync(
    process.execPath,
    ["dist/cli/main.js", "export-wav", input, "-o", wavWithoutRests, "--sample-rate", "8000", "--omit-initial-rest"],
    { cwd: repoDir },
  );

  assert.ok((await readFile(midiWithoutRests)).length < (await readFile(midiWithRests)).length);
  assert.ok((await readFile(wavWithoutRests)).length < (await readFile(wavWithRests)).length);
});

test("CLI rejects invalid WAV sample rates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.wav");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-wav", input, "-o", output, "--sample-rate", "0"], {
      cwd: repoDir,
    }),
    /--sample-rate must be a positive number/,
  );
});

test("CLI rejects invalid WAV amplitudes", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.wav");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-wav", input, "-o", output, "--amplitude", "2"], {
      cwd: repoDir,
    }),
    /--amplitude must be a number greater than 0 and no more than 1/,
  );
});

test("CLI rejects invalid MP3 bit rates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.mp3");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-mp3", input, "-o", output, "--bit-rate", "0"], {
      cwd: repoDir,
    }),
    /--bit-rate must be a positive number/,
  );
});

test("CLI rejects out-of-range MIDI programs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jpu");
  const output = join(dir, "score.mid");
  await writeFile(input, "X", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", output, "--program", "175"], {
      cwd: repoDir,
    }),
    /--program must be an integer from 0 to 174/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", output, "--program", "-1"], {
      cwd: repoDir,
    }),
    /--program must be an integer from 0 to 174/,
  );
});
