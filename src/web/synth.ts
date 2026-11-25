import { Sequencer, WorkletSynthesizer } from "spessasynth_lib";
import processorUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";
import limiterUrl from "./peak-limiter-worklet.ts?worker&url";
import { loadSoundfont } from "./soundfont.js";

export async function createPreviewSynth(context: AudioContext) {
  await Promise.all([context.audioWorklet.addModule(processorUrl), context.audioWorklet.addModule(limiterUrl)]);
  const synth = new WorkletSynthesizer(context);
  try {
    await synth.soundBankManager.addSoundBank((await loadSoundfont()).slice(0), "main");
    await synth.isReady;
    synth.setSystemParameter("voiceCap", 256);
    const masterGain = context.createGain();
    const limiter = new AudioWorkletNode(context, "jianpu-peak-limiter", {
      channelCount: 2,
      channelCountMode: "explicit",
      outputChannelCount: [2],
    });
    const sequencer = new Sequencer(synth, { skipToFirstNoteOn: false });
    sequencer.loopCount = 0;
    synth.connect(masterGain);
    masterGain.connect(limiter).connect(context.destination);
    return { synth, sequencer, masterGain };
  } catch (error) {
    synth.destroy();
    throw error;
  }
}
