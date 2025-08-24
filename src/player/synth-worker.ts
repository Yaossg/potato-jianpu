import { synthMusic } from "./synth";

onmessage = async (e) => {
    const { source, program, volume, sampleRate, startIndex } = e.data;
    const blob = await synthMusic(source, program, volume, sampleRate, startIndex);
    postMessage({ blob });
}