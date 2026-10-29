import soundfontUrl from "../../assets/soundfonts/GeneralUser-GS.sf2?url";

export type AudioLoadStatus = { phase: "preparing" } | { phase: "downloading"; loaded: number; total?: number };
export type AudioLoadListener = (status: AudioLoadStatus | null) => void;
let loading: Promise<ArrayBuffer> | undefined;
let progress: AudioLoadStatus | null = null;
const listeners = new Set<AudioLoadListener>();

export function subscribeSoundfontProgress(listener: AudioLoadListener): () => void {
  listeners.add(listener);
  if (progress) listener(progress);
  return () => { listeners.delete(listener); };
}

function report(status: AudioLoadStatus | null) {
  progress = status;
  for (const listener of listeners) listener(status);
}

async function downloadSoundfont(): Promise<ArrayBuffer> {
  report({ phase: "downloading", loaded: 0 });
  const response = await fetch(soundfontUrl);
  if (!response.ok) throw new Error(`SoundFont: HTTP ${response.status}`);
  const length = Number(response.headers.get("content-length"));
  // A compressed Content-Length describes transferred bytes, not decoded chunks.
  const encoding = response.headers.get("content-encoding");
  const total = (!encoding || encoding === "identity") && Number.isFinite(length) && length > 0 ? length : undefined;
  report({ phase: "downloading", loaded: 0, total });
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loaded = 0;
  let reportedAt = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      const now = performance.now();
      if (now - reportedAt >= 100) {
        report({ phase: "downloading", loaded, total: total && loaded <= total ? total : undefined });
        reportedAt = now;
      }
    }
  } finally {
    reader.releaseLock();
  }
  report({ phase: "downloading", loaded, total: total && loaded <= total ? total : undefined });
  const buffer = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  return buffer.buffer;
}

export async function loadSoundfont(onProgress?: AudioLoadListener): Promise<ArrayBuffer> {
  const unsubscribe = onProgress ? subscribeSoundfontProgress(onProgress) : undefined;
  try {
    loading ??= downloadSoundfont().then((buffer) => {
      report(null);
      return buffer;
    }).catch((error) => {
      loading = undefined;
      report(null);
      throw error;
    });
    return await loading;
  } finally {
    unsubscribe?.();
  }
}
