import {
  AudioSample, AudioSampleSource, BufferTarget, CanvasSource, Mp4OutputFormat,
  Output, Quality, WebMOutputFormat, canEncodeAudio, canEncodeVideo,
} from "mediabunny";
import type { Document as ScoreDocument } from "../core/index.js";
import { compileArrangement, skipInitialArrangementRests } from "../player/index.js";
import { renderSvg, type RenderOptions } from "../renderer/index.js";
import { renderDocumentPcm, type BrowserAudioExportOptions } from "./audio-export.js";
import { embedPngExportFonts } from "./svg-fonts.js";
import { abortable, createVideoTimeline, followVideoNotes, type VideoBounds } from "./video-timeline.js";

export type VideoExportPhase = "preparing" | "rendering" | "finalizing";
export interface VideoExportOptions extends BrowserAudioExportOptions {
  signal: AbortSignal;
  renderOptions: RenderOptions;
  onProgress: (phase: VideoExportPhase, progress: number) => void;
}

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 30;
const SAMPLE_RATE = 48000;
const VIDEO_QUALITY = new Quality({ bitrate: 4_000_000 });
const AUDIO_QUALITY = new Quality({ bitrate: 128_000 });

export class VideoUnsupportedError extends Error {}

async function chooseFormat() {
  for (const candidate of [
    { extension: "mp4", video: "avc", audio: "aac" },
    { extension: "webm", video: "vp9", audio: "opus" },
    { extension: "webm", video: "vp8", audio: "opus" },
  ] as const) {
    const [video, audio] = await Promise.all([
      canEncodeVideo(candidate.video, { width: WIDTH, height: HEIGHT, frameRate: FPS, quality: VIDEO_QUALITY }),
      canEncodeAudio(candidate.audio, { sampleRate: SAMPLE_RATE, numberOfChannels: 2, quality: AUDIO_QUALITY }),
    ]);
    if (video && audio) return candidate;
  }
  throw new VideoUnsupportedError();
}

/** Rasterize only the current viewport, never a score-sized bitmap. */
async function createScorePainter(score: ScoreDocument, options: VideoExportOptions) {
  const svgText = await abortable(embedPngExportFonts(renderSvg(score, {
    ...options.renderOptions, activeNoteIndices: [], activeNoteIndex: undefined,
  })), options.signal);
  const root = new DOMParser().parseFromString(svgText, "image/svg+xml").documentElement as unknown as SVGSVGElement;
  const scoreWidth = Number(root.getAttribute("width"));
  const scoreHeight = Number(root.getAttribute("height"));
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = "position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none";
  holder.appendChild(root);
  document.body.appendChild(holder);
  const nodes = new Map<number, SVGGraphicsElement>();
  const bounds = new Map<number, VideoBounds>();
  try {
    // Force layout before waiting for the SVG's embedded fonts.
    root.getBoundingClientRect();
    await abortable(document.fonts.ready, options.signal);
    const rootRect = root.getBoundingClientRect();
    const scale = scoreWidth / rootRect.width;
    root.querySelectorAll<SVGGraphicsElement>("[data-note-index]").forEach(node => {
      const index = Number(node.getAttribute("data-note-index"));
      const rect = node.getBoundingClientRect();
      nodes.set(index, node);
      bounds.set(index, { top: (rect.top - rootRect.top) * scale, bottom: (rect.bottom - rootRect.top) * scale });
    });
  } finally {
    holder.remove();
  }
  root.setAttribute("width", String(WIDTH));
  root.setAttribute("height", String(HEIGHT));
  const serializer = new XMLSerializer();
  let lastKey: string | undefined;
  let previousIndices: number[] = [];
  let top = 0;
  return async (context: CanvasRenderingContext2D, indices: number[]) => {
    const key = indices.join(",");
    if (key === lastKey) return;
    for (const index of previousIndices) nodes.get(index)?.classList.remove("active");
    for (const index of indices) nodes.get(index)?.classList.add("active");
    const activeBounds = indices.flatMap(index => bounds.has(index) ? [bounds.get(index)!] : []);
    const span = activeBounds.length ? Math.max(...activeBounds.map(b => b.bottom)) - Math.min(...activeBounds.map(b => b.top)) : 0;
    const viewHeight = Math.max(scoreWidth * HEIGHT / WIDTH, span + 80);
    const viewWidth = viewHeight * WIDTH / HEIGHT;
    top = followVideoNotes(top, viewHeight, scoreHeight, activeBounds);
    root.setAttribute("viewBox", `${(scoreWidth - viewWidth) / 2} ${top} ${viewWidth} ${viewHeight}`);
    const url = URL.createObjectURL(new Blob([serializer.serializeToString(root)], { type: "image/svg+xml" }));
    const image = new Image();
    try {
      image.src = url;
      await abortable(image.decode(), options.signal);
      options.signal.throwIfAborted();
      context.fillStyle = options.renderOptions.background || "#ffffff";
      context.fillRect(0, 0, WIDTH, HEIGHT);
      context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    } finally {
      image.src = "";
      URL.revokeObjectURL(url);
    }
    lastKey = key;
    previousIndices = indices;
  };
}

export async function exportBrowserVideo(score: ScoreDocument, options: VideoExportOptions) {
  const { signal, onProgress } = options;
  signal.throwIfAborted();
  onProgress("preparing", 0);
  const format = await abortable(chooseFormat(), signal);
  const compiled = compileArrangement(score, options.program);
  const arrangement = options.omitInitialRests ? skipInitialArrangementRests(compiled) : compiled;
  const activeAt = createVideoTimeline(arrangement);
  const audio = await abortable(renderDocumentPcm(score, {
    ...options, sampleRate: SAMPLE_RATE,
    onLoadStatus: status => { if (!signal.aborted) options.onLoadStatus?.(status); },
  }, "Video"), signal);
  const paint = await createScorePainter(score, options);
  signal.throwIfAborted();
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const output = new Output({
    format: format.extension === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const videoSource = new CanvasSource(canvas, { codec: format.video, quality: VIDEO_QUALITY });
  const audioSource = new AudioSampleSource({ codec: format.audio, quality: AUDIO_QUALITY });
  output.addVideoTrack(videoSource, { frameRate: FPS });
  output.addAudioTrack(audioSource);
  const cancel = () => { void output.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    signal.throwIfAborted();
    await output.start();
    const duration = audio.frames / audio.sampleRate;
    const frameCount = Math.ceil(duration * FPS);
    let audioCursor = 0;
    let yieldedAt = performance.now();
    for (let frame = 0; frame < frameCount; frame++) {
      signal.throwIfAborted();
      const timestamp = frame / FPS;
      const end = Math.min((frame + 1) / FPS, duration);
      await paint(context, activeAt(timestamp));
      await videoSource.add(timestamp, end - timestamp);
      // Interleave audio and video so the muxer need not buffer a whole track.
      const audioEnd = Math.min(audio.frames, Math.round(end * audio.sampleRate));
      if (audioEnd > audioCursor) {
        const sample = new AudioSample({
          data: audio.pcm.subarray(audioCursor * 2, audioEnd * 2), format: "s16",
          numberOfChannels: 2, sampleRate: audio.sampleRate, timestamp: audioCursor / audio.sampleRate,
        });
        try { await audioSource.add(sample); } finally { sample.close(); }
        audioCursor = audioEnd;
      }
      if (performance.now() - yieldedAt > 40 || frame === frameCount - 1) {
        onProgress("rendering", (frame + 1) / frameCount);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        yieldedAt = performance.now();
      }
    }
    signal.throwIfAborted();
    videoSource.close();
    audioSource.close();
    onProgress("finalizing", 1);
    await output.finalize();
    signal.throwIfAborted();
    return { blob: new Blob([output.target.buffer!], { type: `video/${format.extension}` }), extension: format.extension };
  } finally {
    signal.removeEventListener("abort", cancel);
    if (output.state !== "finalized") await output.cancel();
    canvas.width = canvas.height = 0;
  }
}
