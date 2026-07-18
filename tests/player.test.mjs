import test from "node:test";
import assert from "node:assert/strict";
import { parse } from "../dist/parser/index.js";
import {
  arrangementDuration,
  compileArrangement,
  compileMelody,
  exportMidiBytes,
  melodyPitchSpans,
  midiToFrequency,
  sampleWave,
  skipInitialArrangementRests,
  skipInitialRests,
  SYNTH_WAVEFORM,
  triangleWave,
  waveformForProgram,
} from "../dist/player/index.js";

function readUint32(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readMidiVarInt(bytes, start) {
  let value = 0;
  let offset = start;
  while (offset < bytes.length) {
    const byte = bytes[offset++];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return { value, offset };
}

function midiNoteEvents(bytes) {
  const events = [];
  let chunkOffset = 8 + readUint32(bytes, 4);
  let track = 0;
  while (chunkOffset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.slice(chunkOffset, chunkOffset + 4));
    const length = readUint32(bytes, chunkOffset + 4);
    let offset = chunkOffset + 8;
    const end = offset + length;
    if (type !== "MTrk") {
      chunkOffset = end;
      continue;
    }
    let tick = 0;
    let runningStatus;
    while (offset < end) {
      const delta = readMidiVarInt(bytes, offset);
      tick += delta.value;
      offset = delta.offset;
      let status = bytes[offset];
      if (status >= 0x80) {
        offset += 1;
        if (status < 0xf0) runningStatus = status;
      } else {
        status = runningStatus;
      }
      if (status === undefined) throw new Error("MIDI running status is missing");
      if (status === 0xff) {
        offset += 1;
        const metaLength = readMidiVarInt(bytes, offset);
        offset = metaLength.offset + metaLength.value;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        const dataLength = readMidiVarInt(bytes, offset);
        offset = dataLength.offset + dataLength.value;
        continue;
      }
      const kind = status & 0xf0;
      const note = bytes[offset++];
      const data = kind === 0xc0 || kind === 0xd0 ? undefined : bytes[offset++];
      if (kind === 0x90 && data !== 0) events.push({ track, tick, type: "on", note, velocity: data });
      if (kind === 0x80 || (kind === 0x90 && data === 0)) events.push({ track, tick, type: "off", note });
    }
    track += 1;
    chunkOffset = end;
  }
  return events;
}

test("compiles pitch notes to MIDI notes with key and octave", () => {
  const result = parse(`key: D\n===\n1 2 1'`);
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[62], [64], [74]],
  );
});

test("plays slurs with legato overlap without changing the rhythmic timeline", () => {
  const plain = parse("1 2 3 4");
  const slurred = parse("$(1 2 3 4)");
  const counted = parse("$$(1 2 3 4)");
  assert.equal(plain.ok, true);
  assert.equal(slurred.ok, true);
  assert.equal(counted.ok, true);
  const plainMelody = compileMelody(plain.value);
  const slurredMelody = compileMelody(slurred.value);
  const countedMelody = compileMelody(counted.value);
  assert.deepEqual(slurredMelody.notes.map((note) => note.duration), plainMelody.notes.map((note) => note.duration));
  assert.deepEqual(slurredMelody.notes.map((note) => note.legatoToIndex), [1, 2, 3, undefined]);
  assert.deepEqual(countedMelody, slurredMelody);
  assert.deepEqual(
    melodyPitchSpans(slurredMelody.notes).map((span) => span.offset),
    [0, 1 / 4, 1 / 2, 3 / 4],
  );
  assert.deepEqual(
    melodyPitchSpans(slurredMelody.notes).map((span) => span.duration),
    [0.2625, 0.2625, 0.2625, 0.25],
  );
  assert.notDeepEqual(exportMidiBytes(slurred.value), exportMidiBytes(plain.value));
});

test("extends fermata notes, chords, rests, drums, and tied segments", () => {
  const fermatas = parse("1(.)- {1 3 5}(.) 0(.) X(.) 2 ~2(.)");
  assert.equal(fermatas.ok, true);
  const melody = compileMelody(fermatas.value);
  assert.deepEqual(melody.notes.map((note) => note.duration), [3 / 4, 3 / 8, 3 / 8, 3 / 8, 5 / 8]);
  assert.equal(arrangementDuration(compileArrangement(fermatas.value)), 5 / 2);

  const plain = parse("1- {1 3 5} 0 X 2 ~2");
  assert.equal(plain.ok, true);
  assert.notDeepEqual(exportMidiBytes(fermatas.value), exportMidiBytes(plain.value));
});

test("applies corresponding fermatas consistently across simultaneous tracks", () => {
  const result = parse("T1: 1(.) 2\nT2: 5,(.) 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(arrangement.tracks.map((track) => track.notes.map((note) => note.duration)), [
    [3 / 8, 1 / 4],
    [3 / 8, 1 / 4],
  ]);
  assert.equal(arrangementDuration(arrangement), 5 / 8);
});

test("breaks slur legato at rests and repeated pitches", () => {
  const result = parse("$(1 0 2 3 3)");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(melody.notes.map((note) => note.legatoToIndex), [undefined, undefined, 3, 4, undefined]);
  assert.deepEqual(melodyPitchSpans(melody.notes).map((span) => span.duration), [1 / 4, 0.2625, 1 / 4, 1 / 4]);
});

test("keeps slur playback track-local and idempotent for nested spans", () => {
  const result = parse("T1: $($(1 2) 3)\nT2: 5 6 7");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => melodyPitchSpans(track.notes).map((span) => span.duration)),
    [[0.2625, 0.2625, 0.25], [0.25, 0.25, 0.25]],
  );
});

test('plays ignored same-pitch slides as ordinary notes', () => {
  const result = parse('time: 3/4\n===\n1(~)- 1');
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics[0]?.severity, 'warning');
  const melody = compileMelody(result.value);
  assert.deepEqual(melody.notes.map((note) => note.chord), [[60], [60]]);
  assert.deepEqual(melody.notes.map((note) => note.duration), [1 / 2, 1 / 4]);
});

test("keeps accidentals for the current measure only", () => {
  const result = parse("#4 4 | 4");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[66], [66], [65]],
  );
});

test("expands mordents with key and accidental-aware auxiliary pitches", () => {
  const result = parse("key: D\n===\n1(^) #1(v)");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[62], [64], [62], [62], [63], [61], [63], [63]],
  );
  assert.equal(melody.notes.reduce((sum, note) => sum + note.duration, 0), 1 / 2);
});

test("ornaments the highest sounding chord member while sustaining the others", () => {
  const result = parse("{5 1' 3}(^) {5 1' 3}(z) {5 1' 3}(tr)//");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.slice(0, 4).map((note) => note.chord),
    [[67, 72, 64], [67, 74, 64], [67, 72, 64], [67, 72, 64]],
  );
  assert.deepEqual(
    melody.notes.slice(4, 9).map((note) => note.chord),
    [[67, 74, 64], [67, 72, 64], [67, 71, 64], [67, 72, 64], [67, 72, 64]],
  );
  assert.deepEqual(
    melody.notes.slice(9).map((note) => note.chord),
    [[67, 72, 64], [67, 74, 64]],
  );

  const spans = melodyPitchSpans(melody.notes.slice(0, 4));
  assert.equal(spans.filter((span) => span.note === 67).length, 1);
  assert.equal(spans.filter((span) => span.note === 64).length, 1);
  assert.equal(spans.find((span) => span.note === 67)?.duration, 1 / 4);
  assert.equal(spans.find((span) => span.note === 64)?.duration, 1 / 4);
});

test("connects grace notes to whole chord anchors", () => {
  const result = parse("{1 3 5}(<2) {1 3 5}(>6)");
  assert.equal(result.ok, true);
  assert.deepEqual(
    compileMelody(result.value).notes.map((note) => note.chord),
    [[62], [60, 64, 67], [60, 64, 67], [69]],
  );
});

test("expands slides chromatically through the final quarter of the source note", () => {
  const result = parse("key: D\n===\n1(~)- #3");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[62], [63], [64], [65], [66], [67], [67]],
  );
  assert.equal(melody.notes[0].duration, 3 / 8);
  assert.equal(melody.notes.slice(1, 6).reduce((sum, note) => sum + note.duration, 0), 1 / 8);
  assert.ok(Math.abs(melody.notes.reduce((sum, note) => sum + note.duration, 0) - 3 / 4) < 1e-9);
});

test("keeps MIDI slide subdivisions on the written target boundary", () => {
  const cases = [
    { source: "time: 2/4\n===\n1(~) 4", targetTick: 96, endTick: 192 },
    { source: "time: 2/4\n===\n7(~) 1", targetTick: 96, endTick: 192 },
    { source: "1(~)/ 4/", targetTick: 48, endTick: 96 },
    { source: "1(~)// 4//", targetTick: 24, endTick: 48 },
  ];
  for (const { source, targetTick, endTick } of cases) {
    const result = parse(source);
    assert.equal(result.ok, true);
    const events = midiNoteEvents(exportMidiBytes(result.value));
    assert.equal(events.filter((event) => event.type === "on").at(-1)?.tick, targetTick, source);
    assert.equal(Math.max(...events.filter((event) => event.type === "off").map((event) => event.tick)), endTick, source);
  }
});

test("does not accumulate MIDI timing drift across consecutive slides", () => {
  const result = parse("time: 4/4\n===\n1(~) 4 1(~) 4");
  assert.equal(result.ok, true);
  const events = midiNoteEvents(exportMidiBytes(result.value));
  const noteOns = events.filter((event) => event.type === "on");
  assert.deepEqual(noteOns.filter((event) => event.note === 65).map((event) => event.tick), [91, 96, 283, 288]);
  assert.equal(Math.max(...events.filter((event) => event.type === "off").map((event) => event.tick)), 384);
});

test("expands turns with upper and lower auxiliary pitches", () => {
  const result = parse("key: D\n===\n1(z) #1(s)");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[64], [62], [61], [62], [62], [61], [63], [64], [63], [63]],
  );
  assert.equal(melody.notes.reduce((sum, note) => sum + note.duration, 0), 1 / 2);
});

test("expands trills at thirty-second-note density with accidental-aware upper pitches", () => {
  const result = parse("key: D\n===\n#2 1(tr) 7(tr)//");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[65], [62], [65], [62], [65], [62], [65], [62], [65], [73], [74]],
  );
  assert.deepEqual(
    melody.notes.slice(1).map((note) => note.duration),
    Array(10).fill(1 / 32),
  );
  assert.equal(melody.notes.reduce((sum, note) => sum + note.duration, 0), 9 / 16);
});

test("plays short and long trill notation identically", () => {
  const short = parse("f 1(tr)-");
  const long = parse("f 1(tr~)-");
  assert.equal(short.ok, true);
  assert.equal(long.ok, true);
  assert.deepEqual(compileMelody(long.value), compileMelody(short.value));
});

test("exports ornament-expanded MIDI note-ons", () => {
  const result = parse("1(^)");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  const noteOns = [];
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] === 0x90) {
      noteOns.push(bytes[index + 1]);
    }
  }
  assert.deepEqual(noteOns, [60, 62, 60]);
});

test("exports sustained chord members with one MIDI attack", () => {
  const result = parse("{1 3 5}(^)");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  const noteOns = [];
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] === 0x90) {
      noteOns.push(bytes[index + 1]);
    }
  }
  assert.deepEqual(noteOns, [60, 64, 67, 69, 67]);
});

test("expands before and after grace ornaments without changing total duration", () => {
  const result = parse("1(<23) 4(>5)");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[62], [64], [60], [65], [67]],
  );
  assert.deepEqual(
    melody.notes.map((note) => note.duration),
    [1 / 32, 1 / 32, 3 / 16, 3 / 16, 1 / 16],
  );
  assert.equal(melody.notes.reduce((sum, note) => sum + note.duration, 0), 1 / 2);
});

test("merges tied notes into previous melody note", () => {
  const result = parse("1 ~1/ 2");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.equal(melody.notes.length, 2);
  assert.equal(melody.notes[0].duration, 3 / 8);
});

test("expands repeat barlines for melody playback", () => {
  const result = parse("|: 1 | 2 :| 3");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [64]],
  );
});

test("expands implicit repeat starts from the line beginning", () => {
  const result = parse("1 | 2 :| 3");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [64]],
  );
});

test("expands combined repeat end and start barlines for melody playback", () => {
  const result = parse("|: 1 :|: 2 :|");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [60], [62], [62]],
  );
});

test("plays repeated endings on the matching pass", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [64]],
  );
});

test("plays repeated endings beyond the second pass", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 :| [3] 4 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [64], [60], [65]],
  );
});

test("plays one repeated ending on multiple passes", () => {
  const result = parse("|: 1 | [1,2] 2 :| [3] 3 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [60], [64]],
  );
});

test("plays non-contiguous passes in one repeated ending", () => {
  const result = parse("1111|[1,3]2222:|[2]3333:|[4]4444");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [64],
      [64],
      [64],
      [64],
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [65],
      [65],
      [65],
      [65],
    ],
  );
});

test("plays a multi-pass ending before an explicit final pass", () => {
  const result = parse("1111|[1,2]2222:|[3]3333");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [64],
      [64],
      [64],
      [64],
    ],
  );
});

test("plays repeated endings across source lines", () => {
  const result = parse("|: 1 | [1] 2\n3 :| [2] 4 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [64], [60], [65]],
  );
});

test("plays repeated endings in multiple repeat sections", () => {
  const result = parse("|: 1 | [1] 2 :| [2] 3 | 4 |: 5 | [1] 6 :| [2] 7 |");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [64], [65], [67], [69], [67], [71]],
  );
});

test("plays adjacent repeated ending groups independently", () => {
  const result = parse("1111|[1]2222:|[2]3333\n1111|[1]4444:|[2]5555");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [
      [60],
      [60],
      [60],
      [60],
      [62],
      [62],
      [62],
      [62],
      [60],
      [60],
      [60],
      [60],
      [64],
      [64],
      [64],
      [64],
      [60],
      [60],
      [60],
      [60],
      [65],
      [65],
      [65],
      [65],
      [60],
      [60],
      [60],
      [60],
      [67],
      [67],
      [67],
      [67],
    ],
  );
});

test("plays D.C. navigation until Fine", () => {
  const result = parse("1 [Fine] | 2 [D.C.] | 3");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60]],
  );
});

test("plays D.S. navigation from Segno until Fine", () => {
  const result = parse("[Segno] 1 | 2 [Fine] | 3 [D.S.] | 4");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [64], [60], [62]],
  );
});

test("plays To Coda after a D.S. jump", () => {
  const result = parse("[Segno] 1 | 2 [To Coda] | 3 [D.S.] | [Coda] 4 | 5");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [64], [60], [62], [65], [67]],
  );
});

test("applies navigation after repeat expansion", () => {
  const result = parse("|: 1 [Fine] | 2 :| 3 [D.C.]");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[60], [62], [60], [62], [64], [60]],
  );
});

test("keeps unlabeled scores as one sequential arrangement track", () => {
  const result = parse("1 2\n3 4");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.equal(arrangement.tracks.length, 1);
  assert.equal(arrangement.tracks[0].name, "");
  assert.deepEqual(
    arrangement.tracks[0].notes.map((note) => note.chord),
    [[60], [62], [64], [65]],
  );
});

test("groups labeled score lines into simultaneous arrangement tracks", () => {
  const result = parse("T1: 1 2\nT2: 5, 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "T2"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62]],
      [[55], [57]],
    ],
  );
  assert.equal(arrangementDuration(arrangement), 1 / 2);
});

test("uses per-track header programs with global fallback", () => {
  const result = parse(`T2.program: "Violin"\nT3.program: "Flute"\n===\nT1: 1\nT2: 5,\nT3: 3`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 24);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [
      ["T1", 24],
      ["T2", 40],
      ["T3", 73],
    ],
  );
});

test("uses default header program before API fallback", () => {
  const result = parse(`program: 24\nT2.program: "Violin"\n===\nT1: 1\nT2: 5,`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 73);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [
      ["T1", 24],
      ["T2", 40],
    ],
  );
});

test("uses T1 program and name for a single unlabeled arrangement track", () => {
  const result = parse(`T1.name: "Melody"\nT1.program: "Violin"\n===\n1 2\n3 4`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 24);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [["T1", 40]],
  );
});

test("ignores unused per-track programs for unlabeled arrangements", () => {
  const result = parse(`T3.program: "Flute"\n===\n1 2 3`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value, 24);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.program]),
    [["", 24]],
  );
});

test("uses per-track header volumes with neutral fallback", () => {
  const result = parse(`T2.volume: 72.5%\nT3.volume: 2\n===\nT1: 1\nT2: 5,\nT3: 3`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.volume]),
    [
      ["T1", 1],
      ["T2", 0.725],
      ["T3", 2],
    ],
  );
});

test("uses default header volume before neutral fallback", () => {
  const result = parse(`volume: 25%\nT2.volume: 50%\n===\nT1: 1\nT2: 5,`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.volume]),
    [
      ["T1", 0.25],
      ["T2", 0.5],
    ],
  );
});

test("uses T1 volume for a single unlabeled arrangement track", () => {
  const result = parse(`T1.volume: 0.25\n===\n1 2\n3 4`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => [track.name, track.volume]),
    [["", 0.25]],
  );
});

test("concatenates repeated labels and treats unlabeled lines as T1 in labeled scores", () => {
  const result = parse("T1: 1\nT2: 5,\n3\nT1: 2\nT2: 6,\n4");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "T2"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [64], [62], [65]],
      [[55], "rest", [57]],
    ],
  );
});

test("schedules incomplete track groups sequentially instead of overlapping later voices", () => {
  const result = parse("T1: 1\nT1: 2\nT2: 5,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "T2"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62]],
      ["rest", [55]],
    ],
  );
});

test("expands repeats independently inside each arrangement track", () => {
  const result = parse("T1: |: 1 :| 2\nT2: |: 5, :| 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [60], [62]],
      [[55], [55], [57]],
    ],
  );
});

test("expands labeled repeats across later groups in the same track", () => {
  const result = parse("T1: |: 1\nT2: 5,\nT1: 2 :|\nT2: 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62], [60], [62]],
      [[55], [57]],
    ],
  );
});

test("keeps later groups after earlier in-line repeats finish", () => {
  const result = parse("T1: |: 1 :|\nT2: 5,\nT1: 2\nT2: 6,");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [60], [62]],
      [[55], "rest", [57]],
    ],
  );
});

test("applies primary navigation order to labeled arrangement tracks", () => {
  const result = parse("T1: 1 [Fine]\nP1: X\nT1: 2 [D.C.]\nP1: X");
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.deepEqual(
    arrangement.tracks.map((track) => track.name),
    ["T1", "P1"],
  );
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [
      [[60], [62], [60]],
      [[35], [35], [35]],
    ],
  );
});

test("omits shared initial arrangement rests only up to the first sounding track", () => {
  const result = parse("T1: 0 1\nT2: 0 0 5,");
  assert.equal(result.ok, true);
  const arrangement = skipInitialArrangementRests(compileArrangement(result.value));
  assert.deepEqual(
    arrangement.tracks.map((track) => track.notes.map((note) => note.chord)),
    [[[60]], ["rest", [55]]],
  );
});

test("exports a standard MIDI header", () => {
  const result = parse(`tempo: 120\n===\n1 2 3 4`);
  assert.equal(result.ok, true);
  const bytes = exportMidiBytes(result.value);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "MThd");
  assert.equal(String.fromCharCode(...bytes.slice(14, 18)), "MTrk");
  assert.equal(bytes[8], 0);
  assert.equal(bytes[9], 1);
});

test("exports labeled arrangement tracks as separate MIDI tracks", () => {
  const result = parse("T1: 1\nT2: 5,\nT3: 3");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  assert.equal(bytes[10] * 256 + bytes[11], 4);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc0 && bytes[index + 1] === 0), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 0), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc2 && bytes[index + 1] === 0), -1);
});

test("exports separate MIDI program changes for per-track programs", () => {
  const result = parse(`T1.program: 24\nT2.program: "Violin"\n===\nT1: 1\nT2: 5,`);
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value, 0)];
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc0 && bytes[index + 1] === 24), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 40), -1);
  assert.equal(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 0), -1);
});

test("exports per-track MIDI velocities from track volumes", () => {
  const result = parse(`T1.volume: 50%\nT2.volume: 2\n===\nT1: 1\nT2: 5,`);
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0x90 && bytes[index + 1] === 60 && bytes[index + 2] === 32), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0x91 && bytes[index + 1] === 55 && bytes[index + 2] === 127), -1);
});

test("reserves labeled MIDI channels before assigning unlabeled arrangement tracks", () => {
  const result = parse("T1: 5,\n1");
  assert.equal(result.ok, true);
  result.value.score[0].label = "T2";
  result.value.score[1].label = undefined;
  const bytes = [...exportMidiBytes(result.value)];
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc1 && bytes[index + 1] === 0), -1);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0xc0 && bytes[index + 1] === 0), -1);
});

test("rejects MIDI exports with too many melodic arrangement tracks", () => {
  const result = parse("T1: 1\nT2: 1\nT3: 1\nT4: 1\nT5: 1\nT6: 1\nT7: 1\nT8: 1\nT9: 1\nT11: 1\nT12: 1\nT13: 1\nT14: 1\nT15: 1\nT16: 1");
  assert.equal(result.ok, true);
  result.value.score.push({ ...result.value.score[0], label: undefined });
  assert.throws(() => exportMidiBytes(result.value), /at most 15 melodic tracks/);
});

test("can omit initial rests from compiled melody and MIDI export", () => {
  const result = parse("0 0 1 2");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  const skipped = skipInitialRests(melody);
  assert.deepEqual(
    skipped.notes.map((note) => note.chord),
    [[60], [62]],
  );
  assert.ok(exportMidiBytes(result.value, 0, { omitInitialRests: true }).length < exportMidiBytes(result.value).length);
});

test("omitting initial rests preserves all-rest melodies as empty", () => {
  const result = parse("0 0");
  assert.equal(result.ok, true);
  assert.deepEqual(skipInitialRests(compileMelody(result.value)).notes, []);
});

test("exports tempo and time signature MIDI meta events", () => {
  const result = parse(`tempo: 120\ntime: 6/8\n===\n1/ 2/ 3/ 4/ 5/ 6/`);
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];

  const tempoIndex = bytes.findIndex((byte, index) => byte === 0xff && bytes[index + 1] === 0x51);
  assert.notEqual(tempoIndex, -1);
  assert.deepEqual(bytes.slice(tempoIndex, tempoIndex + 6), [0xff, 0x51, 0x03, 0x0f, 0x42, 0x40]);

  const timeSignatureIndex = bytes.findIndex((byte, index) => byte === 0xff && bytes[index + 1] === 0x58);
  assert.notEqual(timeSignatureIndex, -1);
  assert.deepEqual(bytes.slice(timeSignatureIndex, timeSignatureIndex + 7), [0xff, 0x58, 0x04, 0x06, 0x03, 0x24, 0x08]);
});

test("maps drum programs to percussion channel notes", () => {
  const result = parse("X X");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value, 128);
  assert.deepEqual(
    melody.notes.map((note) => note.chord),
    [[35], [35]],
  );

  const bytes = [...exportMidiBytes(result.value, 128)];
  assert.equal(bytes.includes(0xc9), false);
  assert.notEqual(bytes.findIndex((byte, index) => byte === 0x99 && bytes[index + 1] === 35), -1);
});

test("rejects out-of-range programs in player APIs", () => {
  const result = parse("X");
  assert.equal(result.ok, true);
  assert.throws(() => compileMelody(result.value, 175), /Program must be an integer from 0 to 174/);
  assert.throws(() => exportMidiBytes(result.value, -1), /Program must be an integer from 0 to 174/);
});

test("exposes lightweight WAV synth constants", () => {
  assert.equal(SYNTH_WAVEFORM, "triangle");
  assert.equal(midiToFrequency(69), 440);
  assert.equal(triangleWave(0), 0);
  assert.ok(triangleWave(Math.PI / 2) > 0.99);
  assert.ok(triangleWave((3 * Math.PI) / 2) < -0.99);
});

test("compiles per-note velocity into MelodyNote", () => {
  const result = parse("f 1 p 2");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.equal(melody.notes[0].velocity, 85);
  assert.equal(melody.notes[1].velocity, 49);
});

test("defaults to undefined velocity when no dynamic marker", () => {
  const result = parse("1 2");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.equal(melody.notes[0].velocity, undefined);
  assert.equal(melody.notes[1].velocity, undefined);
});

test("exports per-note MIDI velocities", () => {
  const result = parse("f 1 pp 2");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  const noteOnIndex = bytes.findIndex((byte, i) => byte === 0x90);
  assert.notEqual(noteOnIndex, -1);
  assert.equal(bytes[noteOnIndex + 2], 85);
  const secondNoteOnIndex = bytes.findIndex((byte, i) => i > noteOnIndex && byte === 0x90);
  assert.notEqual(secondNoteOnIndex, -1);
  assert.equal(bytes[secondNoteOnIndex + 2], 33);
});

test("falls back to track-velocity when no per-note velocity", () => {
  const result = parse("T1.volume: 50%\n===\nT1: 1");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  const noteOnIndex = bytes.findIndex((byte, i) => byte === 0x90);
  assert.notEqual(noteOnIndex, -1);
  assert.equal(bytes[noteOnIndex + 2], 32);
});

test("scales per-note velocity by track volume (multiplicative)", () => {
  const result = parse("T1.volume: 50%\n===\nT1: f 1 pp 2");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  const noteOnIndex = bytes.findIndex((byte, i) => byte === 0x90);
  assert.notEqual(noteOnIndex, -1);
  // f (85) * 0.5 = round(42.5) = 43
  assert.equal(bytes[noteOnIndex + 2], 43);
  const secondNoteOnIndex = bytes.findIndex((byte, i) => i > noteOnIndex && byte === 0x90);
  assert.notEqual(secondNoteOnIndex, -1);
  // pp (33) * 0.5 = round(16.5) = 17
  assert.equal(bytes[secondNoteOnIndex + 2], 17);
});

test("compiles hairpins into gradual melody velocities", () => {
  const result = parse("p < 1 2 3 f < 4");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.velocity),
    [49, 61, 73, 85],
  );
});

test("applies one hairpin velocity to every event expanded from a source note", () => {
  for (const ornament of ["(^)", "(z)", "(tr)", "(<3)", "(~)"]) {
    const source = `p < 1 2${ornament} 3 f < 4`;
    const result = parse(source);
    assert.equal(result.ok, true, source);
    const melody = compileMelody(result.value);
    const velocitiesBySource = new Map();
    for (const note of melody.notes) {
      velocitiesBySource.set(note.index, [...(velocitiesBySource.get(note.index) ?? []), note]);
    }
    assert.deepEqual(
      [...velocitiesBySource.entries()].map(([index, notes]) => [index, [...new Set(notes.map((note) => note.velocity))]]),
      [[0, [49]], [1, [61]], [2, [73]], [3, [85]]],
      source,
    );
    const midiVelocities = midiNoteEvents(exportMidiBytes(result.value))
      .filter((event) => event.type === "on")
      .map((event) => event.velocity);
    assert.deepEqual([...new Set(midiVelocities)], [49, 61, 73, 85], source);
  }
});

test("exports hairpin MIDI velocities", () => {
  const result = parse("f > 1 2 3 p > 4");
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];
  const velocities = [];
  for (let index = 0; index < bytes.length - 2; index += 1) {
    if (bytes[index] === 0x90) {
      velocities.push(bytes[index + 2]);
    }
  }
  assert.deepEqual(velocities, [85, 73, 61, 49]);
});

test("uses one note as both hairpin endpoint and next start", () => {
  const result = parse("p < 1 2 f <> 3 4 p > 5");
  assert.equal(result.ok, true);
  const melody = compileMelody(result.value);
  assert.deepEqual(
    melody.notes.map((note) => note.velocity),
    [49, 67, 85, 67, 49],
  );
});

test("maps programs to deterministic synth waveforms", () => {
  assert.equal(waveformForProgram(0), "triangle");
  assert.equal(waveformForProgram(24), "sawtooth");
  assert.equal(waveformForProgram(56), "sawtooth");
  assert.equal(waveformForProgram(80), "square");
  assert.equal(waveformForProgram(104), "sine");
  assert.equal(waveformForProgram(128), "square");
  assert.equal(sampleWave(Math.PI / 2, "sine"), 1);
  assert.equal(sampleWave(Math.PI / 2, "square"), 1);
});

test("compiles multi-P-track arrangement to percussion notes", () => {
  const result = parse(`P1.program: 128\nP2.program: 130\n===\nP1: X X\nP2: X X`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.equal(arrangement.tracks.length, 2);

  const kick = arrangement.tracks.find((t) => t.name === "P1");
  const snare = arrangement.tracks.find((t) => t.name === "P2");
  assert.ok(kick);
  assert.ok(snare);
  assert.equal(kick.program, 128);
  assert.equal(snare.program, 130);
  assert.deepEqual(kick.notes.map((n) => n.chord), [[35], [35]]);
  assert.deepEqual(snare.notes.map((n) => n.chord), [[37], [37]]);
});

test("P track defaults to drum program 128 when no program is specified", () => {
  const result = parse(`P1.name: "Drums"\n===\nP1: X X`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.equal(arrangement.tracks.length, 1);
  assert.equal(arrangement.tracks[0].program, 128);
  assert.deepEqual(arrangement.tracks[0].notes.map((n) => n.chord), [[35], [35]]);
});

test("mixed T and P arrangement routes P tracks to drum channel", () => {
  const result = parse(`T1.program: 0\nP1.program: 128\n===\nT1: 1 2\nP1: X X`);
  assert.equal(result.ok, true);
  const arrangement = compileArrangement(result.value);
  assert.equal(arrangement.tracks.length, 2);

  const melodic = arrangement.tracks.find((t) => t.name === "T1");
  const drum = arrangement.tracks.find((t) => t.name === "P1");
  assert.ok(melodic);
  assert.ok(drum);
  assert.equal(melodic.program, 0);
  assert.equal(drum.program, 128);
});

test("exports MIDI with P tracks on drum channel", () => {
  const result = parse(`P1.program: 128\nP2.program: 130\n===\nP1: X\nP2: X`);
  assert.equal(result.ok, true);
  const bytes = [...exportMidiBytes(result.value)];

  // P1 program 128 → MIDI note 35 on channel 9 (0x99)
  const kickIndex = bytes.findIndex((b, i) => b === 0x99 && bytes[i + 1] === 35);
  assert.notEqual(kickIndex, -1);

  // P2 program 130 → MIDI note 37 on channel 9 (0x99)
  const snareIndex = bytes.findIndex((b, i) => b === 0x99 && bytes[i + 1] === 37);
  assert.notEqual(snareIndex, -1);

  // No program change on drum channel (0xc9 should not appear)
  assert.equal(bytes.includes(0xc9), false);
});
