const worker = new Worker(new URL('./synth-worker.ts', import.meta.url),{ type: 'module' });

export async function synthMusicInWorker(source: string, program: number, volume: number, sampleRate: number, startIndex: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const { blob } = e.data;
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to synthesize music'));
      }
    };

    worker.onerror = (e) => {
      reject(new Error(`Worker error: ${e.message}`));
    };

    worker.postMessage({ source, program, volume, sampleRate, startIndex });
  });
}
