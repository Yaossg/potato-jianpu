declare module 'webaudio-tinysynth' {
    export default class WebAudioTinySynth {
        constructor(options?: {
            quality?: number;
            useReverb?: boolean;
            voices?: number;
        });
        async ready();
        getAudioContext(): AudioContext;
        setAudioContext(audioContext: AudioContext, destinationNode?: AudioNode): void;
        getTimbreName(m: number, n: number): string;
        setQuality(q: number): void;
        setMasterVol(lev: number): void;
        setReverbLev(lev: number): void;
        setLoop(f: number): void;
        setVoices(v: number): void;
        loadMIDI(mididata: ArrayBuffer): void;
        loadMIDIUrl(url: string): void;
        playMIDI(): void;
        stopMIDI(): void;
        locateMIDI(tick: number): void;
        getPlayStatus(): { play: boolean, curTick: number, maxTick: number };
        setTsMode(mode: number): void;
        setTimbre(m: number, n: number, p: object): void;
        reset(): void;
        send(midiMessage: number[], t?: number): void;
        
        // Channel Message Functions
        noteOn(channel: number, note: number, velocity: number, time?: number): void;
        noteOff(channel: number, note: number, time?: number): void;
        setModulation(channel: number, value: number, time?: number): void;
        setChVol(channel: number, value: number, time?: number): void;
        setPan(channel: number, value: number, time?: number): void;
        setExpression(channel: number, value: number, time?: number): void;
        setSustain(channel: number, value: number, time?: number): void;
        setProgram(channel: number, program: number): void;
        setBend(channel: number, value: number, time?: number): void;
        setBendRange(channel: number, value: number): void;
        allSoundOff(channel: number): void;
        resetAllControllers(channel: number): void;
    }
}

