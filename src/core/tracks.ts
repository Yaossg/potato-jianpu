export function isPercussionTrackLabel(label: string): boolean {
  return /^P\d+$/.test(label);
}
