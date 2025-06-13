import { TimeSignature } from "@/parser";
import { toBytes, toVarInt } from "@/util";

const HEADER_CHUNK_TYPE = [0x4d, 0x54, 0x68, 0x64]; // MThd
const HEADER_CHUNK_LENGTH = [0x00, 0x00, 0x00, 0x06];
const HEADER_CHUNK_FORMAT1 = [0x00, 0x01];
const TRACK_CHUNK_TYPE = [0x4d, 0x54, 0x72, 0x6b]; // MTrk
const MESSAGE_NOTEON_PREFIX = 0x90;
const MESSAGE_NOTEOFF_PREFIX = 0x80;
const MESSAGE_PROGRAMCHANGE_PREFIX = 0xc0;
const META_EVENT_PREFIX = 0xff;
const META_EVENT_END = 0x2f;
const META_EVENT_TIMESIG = 0x58;
const META_EVENT_TEMPO = 0x51;
const META_TIMESIG_CC = 0x18; // 24 MIDI clocks per quarter note
const META_TIMESIG_BB = 0x08; // 8 1/32nd notes per quarter note
const TICKS_PER_QUARTER_NOTE = 96; // Resolution of 96 ticks per quarter note
const TICKS_PER_NOTE = TICKS_PER_QUARTER_NOTE * 4;
const MAX_CHANNEL = 15;
const MAX_NOTE = 127;
const MAX_VELOCITY = 127;
const MAX_TICKSPERBEAT = 65535;
const DATAURI_PREFIX = 'data:audio/midi;base64,';

const META_TRACK_CHANNEL = -1; // Meta track does not have a channel

export interface MIDIEvent {
    toBytes(): number[];
}

export class MIDIMetaEvent implements MIDIEvent {
    type: number;
    data: number[];

    constructor(type: number, data: number[] = []) {
        this.type = type;
        this.data = data;
    }

    toBytes(): number[] {
        const delta = 0;
        const bytes: number[] = [];
        bytes.push(...toVarInt(delta));
        bytes.push(META_EVENT_PREFIX, this.type);
        bytes.push(...toVarInt(this.data.length));
        bytes.push(...this.data);
        return bytes;
    }
}

export class MIDINoteEvent implements MIDIEvent {
    delta: number;
    type: number;
    channel: number;
    note: number;
    velocity: number;

    constructor(delta: number, type: number, channel: number, note: number, velocity: number) {
        this.delta = delta;
        this.type = type;   
        this.channel = channel;
        this.note = note;
        this.velocity = velocity;
    }

    toBytes(): number[] {
        return [
            ...toVarInt(this.delta),
            this.type | this.channel,
            this.note,
            this.velocity
        ];
    }
}

export class MIDITrack {
    channel: number;
    program: number;

    events: MIDIEvent[];

    constructor(channel: number, program: number) {
        this.channel = channel;
        this.program = program;
        this.events = [];
    }

    addEvent(event: MIDIEvent) {
        this.events.push(event);
    }

    noteOn(delta: number, note: number, velocity: number) {
        const event = new MIDINoteEvent(Math.round(delta * TICKS_PER_NOTE), MESSAGE_NOTEON_PREFIX, this.channel, note, velocity);
        this.addEvent(event);
    }

    noteOff(delta: number, note: number) {
        const event = new MIDINoteEvent(Math.round(delta * TICKS_PER_NOTE), MESSAGE_NOTEOFF_PREFIX, this.channel, note, 0);
        this.addEvent(event);
    }

    toBytes(): number[] {
        const bytes: number[] = [];
        if (this.channel >= 0 && this.channel <= MAX_CHANNEL) {
            const delta = 0;
            bytes.push(...toVarInt(delta));
            bytes.push(MESSAGE_PROGRAMCHANGE_PREFIX | this.channel, this.program);
        }
        for (const event of this.events) {
            bytes.push(...event.toBytes());
        }
        const endEvent = new MIDIMetaEvent(META_EVENT_END);
        bytes.push(...endEvent.toBytes());
        return [...TRACK_CHUNK_TYPE, ...toBytes(bytes.length, 4), ...bytes];
    }
}

export class MIDIFile {
    tracks: MIDITrack[];
    tempo: number;
    timeSignature: TimeSignature;

    constructor(tempo: number, timeSignature: TimeSignature) {
        this.tracks = [];
        this.tempo = tempo;
        this.timeSignature = timeSignature;
    }

    addTrack(track: MIDITrack) {
        this.tracks.push(track);
    }

    toBytes(): number[] {
        const bytes: number[] = [];
        // Header chunk
        bytes.push(...HEADER_CHUNK_TYPE);
        bytes.push(...HEADER_CHUNK_LENGTH);
        bytes.push(...HEADER_CHUNK_FORMAT1); // format 1
        bytes.push(...toBytes(this.tracks.length + 1, 2)); // number of tracks
        bytes.push(...toBytes(TICKS_PER_QUARTER_NOTE, 2)); // ticks per quarter note

        // Meta track
        {
            const metaTrack = new MIDITrack(META_TRACK_CHANNEL, 0);

            const tempoBytes = toBytes(Math.round(60000000 / this.tempo * this.timeSignature.beatsPerWholeNote / 4), 3);
            metaTrack.addEvent(new MIDIMetaEvent(META_EVENT_TEMPO, tempoBytes));

            const timeSigBytes = [
                this.timeSignature.beatsPerMeasure,
                Math.log2(this.timeSignature.beatsPerWholeNote),
                META_TIMESIG_CC * this.timeSignature.actualNotePerBeat() * 4,
                META_TIMESIG_BB
            ];
            metaTrack.addEvent(new MIDIMetaEvent(META_EVENT_TIMESIG, timeSigBytes));    

            bytes.push(...metaTrack.toBytes());
        }

        // Tracks
        for (const track of this.tracks) {
            bytes.push(...track.toBytes());
        }
        return bytes;
    }

    toDataURI(): string {
        const bytes = this.toBytes();
        const base64 = btoa(String.fromCharCode(...bytes));
        return DATAURI_PREFIX + base64;
    }
}