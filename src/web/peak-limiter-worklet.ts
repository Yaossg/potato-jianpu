import { PeakLimiter } from "../player/peak-limiter.js";

declare const sampleRate: number;
declare class AudioWorkletProcessor {}
declare function registerProcessor(name: string, processor: typeof AudioWorkletProcessor): void;

class PeakLimiterProcessor extends AudioWorkletProcessor {
  private readonly limiter = new PeakLimiter(sampleRate);

  process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const input = inputs[0];
    const [left, right] = outputs[0]!;
    if (input?.length) {
      left!.set(input[0]!);
      right!.set(input[1] ?? input[0]!);
    } else {
      left!.fill(0);
      right!.fill(0);
    }
    this.limiter.process(left!, right!, left!.length);
    return true;
  }
}

registerProcessor("jianpu-peak-limiter", PeakLimiterProcessor);
