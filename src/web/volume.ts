const DEFAULT_MASTER_GAIN_DB = 18;
const DEFAULT_MASTER_GAIN = 10 ** (DEFAULT_MASTER_GAIN_DB / 20);

export function browserMasterGain(amplitude: number): number {
  return amplitude * DEFAULT_MASTER_GAIN;
}

export function formatVolumeGain(volume: number): string {
  if (volume === 0) return "−∞ dB";
  const decibels = DEFAULT_MASTER_GAIN_DB + 20 * Math.log10(volume / 100);
  const rounded = Math.round(decibels * 10) / 10;
  const sign = rounded < 0 ? "−" : rounded > 0 ? "+" : "";
  return `${sign}${Math.abs(rounded)} dB`;
}
