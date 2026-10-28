import { Sequencer, WorkletSynthesizer } from "spessasynth_lib";
import processorUrl from "spessasynth_lib/dist/spessasynth_processor.min.js?url";
import { loadSoundfont } from "./soundfont.js";

export async function createPreviewSynth(context: AudioContext) {
  await context.audioWorklet.addModule(processorUrl);
  const synth = new WorkletSynthesizer(context);
  try {
    await synth.soundBankManager.addSoundBank((await loadSoundfont()).slice(0), "main");
    await synth.isReady;
    synth.setSystemParameter("voiceCap", 256);
    synth.connect(context.destination);
    const sequencer = new Sequencer(synth, { skipToFirstNoteOn: false });
    sequencer.loopCount = 0;
    return { synth, sequencer };
  } catch (error) {
    synth.destroy();
    throw error;
  }
}
