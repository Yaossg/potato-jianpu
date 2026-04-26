import type { Document } from "../core/index.js";
import { actualNotePerBeat } from "../core/index.js";
import { compileMelody, type Melody } from "./melody.js";

const HEADER_CHUNK_TYPE = [0x4d, 0x54, 0x68, 0x64];
const HEADER_CHUNK_LENGTH = [0x00, 0x00, 0x00, 0x06];
const HEADER_CHUNK_FORMAT1 = [0x00, 0x01];
const TRACK_CHUNK_TYPE = [0x4d, 0x54, 0x72, 0x6b];
const MESSAGE_NOTEON_PREFIX = 0x90;
const MESSAGE_NOTEOFF_PREFIX = 0x80;
const MESSAGE_PROGRAMCHANGE_PREFIX = 0xc0;
const META_EVENT_PREFIX = 0xff;
const META_EVENT_END = 0x2f;
const META_EVENT_TIMESIG = 0x58;
const META_EVENT_TEMPO = 0x51;
const META_TIMESIG_CC = 0x18;
const META_TIMESIG_BB = 0x08;
const TICKS_PER_QUARTER_NOTE = 96;
const TICKS_PER_NOTE = TICKS_PER_QUARTER_NOTE * 4;
const DEFAULT_VELOCITY = 64;

function toBytes(number: number, byteCount: number): number[] {
  const bytes: number[] = [];
  let current = number;
  for (let i = 0; i < byteCount; i += 1) {
    bytes[byteCount - 1 - i] = current & 0xff;
    current >>= 8;
  }
  return bytes;
}

function toVarInt(number: number): number[] {
  if (number < 0) {
    throw new Error("Negative numbers are not supported in MIDI variable integers.");
  }
  const bytes: number[] = [];
  let current = number;
  do {
    let byte = current & 0x7f;
    current >>= 7;
    if (bytes.length > 0) {
      byte |= 0x80;
    }
    bytes.push(byte);
  } while (current > 0);
  return bytes.reverse();
}

interface MIDIEvent {
  toBytes(): number[];
}

class MIDIMetaEvent implements MIDIEvent {
  constructor(
    private readonly type: number,
    private readonly data: number[] = [],
  ) {}

  toBytes(): number[] {
    return [0, META_EVENT_PREFIX, this.type, ...toVarInt(this.data.length), ...this.data];
  }
}

class MIDINoteEvent implements MIDIEvent {
  constructor(
    private readonly delta: number,
    private readonly type: number,
    private readonly channel: number,
    private readonly note: number,
    private readonly velocity: number,
  ) {}

  toBytes(): number[] {
    return [...toVarInt(this.delta), this.type | this.channel, this.note, this.velocity];
  }
}

class MIDITrack {
  private readonly events: MIDIEvent[] = [];

  constructor(
    private readonly channel: number,
    private readonly program: number | null,
  ) {}

  addEvent(event: MIDIEvent) {
    this.events.push(event);
  }

  noteOn(delta: number, note: number, velocity: number) {
    this.addEvent(new MIDINoteEvent(Math.round(delta * TICKS_PER_NOTE), MESSAGE_NOTEON_PREFIX, this.channel, note, velocity));
  }

  noteOff(delta: number, note: number) {
    this.addEvent(new MIDINoteEvent(Math.round(delta * TICKS_PER_NOTE), MESSAGE_NOTEOFF_PREFIX, this.channel, note, 0));
  }

  toBytes(): number[] {
    const bytes: number[] = [];
    if (this.channel >= 0 && this.program !== null) {
      bytes.push(0, MESSAGE_PROGRAMCHANGE_PREFIX | this.channel, this.program);
    }
    for (const event of this.events) {
      bytes.push(...event.toBytes());
    }
    bytes.push(...new MIDIMetaEvent(META_EVENT_END).toBytes());
    return [...TRACK_CHUNK_TYPE, ...toBytes(bytes.length, 4), ...bytes];
  }
}

function buildMetaTrack(melody: Melody): number[] {
  const track = new MIDITrack(-1, 0);
  const tempoBytes = toBytes(Math.round((60000000 / melody.tempo) * (melody.beatsPerWholeNote / 4)), 3);
  track.addEvent(new MIDIMetaEvent(META_EVENT_TEMPO, tempoBytes));
  const timeSignature = {
    beatsPerMeasure: melody.beatsPerMeasure as 2 | 3 | 4 | 6 | 9 | 12,
    beatsPerWholeNote: melody.beatsPerWholeNote as 2 | 4 | 8 | 16,
  };
  const timeSigBytes = [
    melody.beatsPerMeasure,
    Math.log2(melody.beatsPerWholeNote),
    META_TIMESIG_CC * actualNotePerBeat(timeSignature) * 4,
    META_TIMESIG_BB,
  ];
  track.addEvent(new MIDIMetaEvent(META_EVENT_TIMESIG, timeSigBytes));
  return track.toBytes();
}

function buildMusicTrack(melody: Melody, program: number): number[] {
  const drum = program >= 128;
  const track = new MIDITrack(drum ? 9 : 0, drum ? null : program);
  let delta = 0;
  for (const note of melody.notes) {
    if (note.chord === "rest") {
      delta += note.duration;
      continue;
    }
    for (const midiNote of note.chord) {
      track.noteOn(delta, midiNote, DEFAULT_VELOCITY);
      delta = 0;
    }
    delta = note.duration;
    for (const midiNote of note.chord) {
      track.noteOff(delta, midiNote);
      delta = 0;
    }
  }
  return track.toBytes();
}

export function exportMidiBytes(document: Document, program = 0): Uint8Array {
  const melody = compileMelody(document, program);
  const tracks = [buildMetaTrack(melody), buildMusicTrack(melody, program)];
  const bytes = [
    ...HEADER_CHUNK_TYPE,
    ...HEADER_CHUNK_LENGTH,
    ...HEADER_CHUNK_FORMAT1,
    ...toBytes(tracks.length, 2),
    ...toBytes(TICKS_PER_QUARTER_NOTE, 2),
    ...tracks.flat(),
  ];
  return new Uint8Array(bytes);
}
