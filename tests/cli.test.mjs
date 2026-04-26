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
  assert.match(stdout, /export-wav/);
});

test("CLI export-svg accepts page width", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 | 3 4 | 5 6 | 7 1' |", "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width", "120"], {
    cwd: repoDir,
  });

  const svg = await readFile(output, "utf8");
  assert.match(svg, /<svg[^>]+width="120"/);
});

test("CLI export-svg accepts explicit color and background", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
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


test("CLI rejects invalid page width", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
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

test("CLI rejects flags with missing values", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
  const output = join(dir, "score.svg");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", input, "-o", output, "--page-width"], {
      cwd: repoDir,
    }),
    /--page-width requires a value/,
  );
});

test("CLI rejects unknown options", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
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
});

test("CLI validates options before reading input files", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-svg", "missing.jp", "--widht", "1000"], {
      cwd: repoDir,
    }),
    /unknown option --widht/,
  );
});



test("CLI validate can emit machine-readable diagnostics", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
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
  const input = join(dir, "score.jp");
  await writeFile(input, `time: "4/4"\n=\n1 2`, "utf8");

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
  const input = join(dir, "score.jp");
  await writeFile(input, `title: "unterminated\n=\n1 2`, "utf8");

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
  const input = join(dir, "score.jp");
  const output = join(dir, "score.wav");
  await writeFile(input, `tempo: "120"\n=\n1 2 3 4`, "utf8");

  await execFileAsync(process.execPath, ["dist/cli/main.js", "export-wav", input, "-o", output, "--sample-rate", "8000", "--amplitude", "0.5"], {
    cwd: repoDir,
  });

  const wav = await readFile(output);
  assert.equal(String.fromCharCode(...wav.slice(0, 4)), "RIFF");
  assert.equal(String.fromCharCode(...wav.slice(8, 12)), "WAVE");
  assert.equal(wav.readUInt32LE(24), 8000);
});

test("CLI export-midi and export-wav can omit initial rests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
  const midiWithRests = join(dir, "with-rests.mid");
  const midiWithoutRests = join(dir, "without-rests.mid");
  const wavWithRests = join(dir, "with-rests.wav");
  const wavWithoutRests = join(dir, "without-rests.wav");
  await writeFile(input, `tempo: "120"\n=\n0 0 1 2`, "utf8");

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
  const input = join(dir, "score.jp");
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
  const input = join(dir, "score.jp");
  const output = join(dir, "score.wav");
  await writeFile(input, "1 2 3 4", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-wav", input, "-o", output, "--amplitude", "2"], {
      cwd: repoDir,
    }),
    /--amplitude must be a number greater than 0 and no more than 1/,
  );
});

test("CLI rejects out-of-range MIDI programs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "jianpu-cli-"));
  const input = join(dir, "score.jp");
  const output = join(dir, "score.mid");
  await writeFile(input, "X", "utf8");

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", output, "--program", "221"], {
      cwd: repoDir,
    }),
    /--program must be an integer from 0 to 220/,
  );

  await assert.rejects(
    execFileAsync(process.execPath, ["dist/cli/main.js", "export-midi", input, "-o", output, "--program", "-1"], {
      cwd: repoDir,
    }),
    /--program must be an integer from 0 to 220/,
  );
});
