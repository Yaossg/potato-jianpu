import soundfontUrl from "../../assets/soundfonts/GeneralUser-GS.sf2?url";

let loading: Promise<ArrayBuffer> | undefined;

export function loadSoundfont(): Promise<ArrayBuffer> {
  loading ??= fetch(soundfontUrl).then((response) => {
    if (!response.ok) throw new Error(`SoundFont: HTTP ${response.status}`);
    return response.arrayBuffer();
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
