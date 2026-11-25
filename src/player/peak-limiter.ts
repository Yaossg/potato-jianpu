const CEILING = 10 ** (-1 / 20);
const LOOKAHEAD_SECONDS = 0.005;
const RELEASE_SECONDS = 0.05;

/** Stereo-linked sample peak limiting with a smoothed lookahead gain. */
export class PeakLimiter {
  readonly delayFrames: number;
  private readonly leftDelay: Float32Array;
  private readonly rightDelay: Float32Array;
  private readonly gains: Float64Array;
  private readonly peakFrames: Float64Array;
  private readonly peaks: Float32Array;
  private readonly release: number;
  private frame = 0;
  private head = 0;
  private tail = 0;
  private gain = 1;
  private gainSum: number;

  constructor(sampleRate: number) {
    this.delayFrames = Math.round(sampleRate * LOOKAHEAD_SECONDS);
    const windowSize = this.delayFrames + 1;
    this.leftDelay = new Float32Array(windowSize);
    this.rightDelay = new Float32Array(windowSize);
    this.gains = new Float64Array(windowSize).fill(1);
    this.peakFrames = new Float64Array(windowSize + 1);
    this.peaks = new Float32Array(windowSize + 1);
    this.release = Math.exp(-1 / (sampleRate * RELEASE_SECONDS));
    this.gainSum = windowSize;
  }

  process(left: Float32Array, right: Float32Array, frames: number, amplitude = 1) {
    const windowSize = this.gains.length;
    const capacity = this.peaks.length;
    for (let i = 0; i < frames; i++) {
      const current = this.frame % windowSize;
      const delayed = (current + 1) % windowSize;
      this.leftDelay[current] = left[i]! * amplitude;
      this.rightDelay[current] = right[i]! * amplitude;
      const peak = Math.max(Math.abs(this.leftDelay[current]!), Math.abs(this.rightDelay[current]!));

      // A decreasing queue keeps the loudest frame in the lookahead window.
      while (this.head < this.tail && this.peakFrames[this.head % capacity]! < this.frame - this.delayFrames) this.head++;
      while (this.head < this.tail && this.peaks[(this.tail - 1) % capacity]! <= peak) this.tail--;
      this.peakFrames[this.tail % capacity] = this.frame;
      this.peaks[this.tail % capacity] = peak;
      this.tail++;

      this.gain = Math.min(CEILING / this.peaks[this.head % capacity]!, 1 - (1 - this.gain) * this.release);
      this.gainSum += this.gain - this.gains[current]!;
      this.gains[current] = this.gain;
      // Every gain in the average accounts for the delayed output frame.
      const outputGain = this.gainSum / windowSize;
      left[i] = this.leftDelay[delayed]! * outputGain;
      right[i] = this.rightDelay[delayed]! * outputGain;
      this.frame++;
    }
  }
}
