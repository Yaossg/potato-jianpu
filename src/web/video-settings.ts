export const VIDEO_SIZES = {
  landscape720: { width: 1280, height: 720 },
  landscape1080: { width: 1920, height: 1080 },
  portrait720: { width: 720, height: 1280 },
  portrait1080: { width: 1080, height: 1920 },
} as const;

export const DEFAULT_VIDEO_SIZE = "landscape720";

export interface VideoDimensions {
  width: number;
  height: number;
}

export const VIDEO_FRAME_RATES = [24, 30, 60] as const;
export const VIDEO_SCALES = [1, 2, 3] as const;
export const DEFAULT_VIDEO_SCALE = 2;

export const VIDEO_BITRATES = {
  videoQualityCompact: 2_000_000,
  videoQualityStandard: 4_000_000,
  videoQualityHigh: 8_000_000,
} as const;

export interface VideoSettings {
  size: VideoDimensions;
  frameRate: (typeof VIDEO_FRAME_RATES)[number];
  quality: keyof typeof VIDEO_BITRATES;
  format: "auto" | "mp4" | "webm";
  highlight: boolean;
}

export const DEFAULT_VIDEO_SETTINGS: VideoSettings = {
  size: VIDEO_SIZES[DEFAULT_VIDEO_SIZE],
  frameRate: 30,
  quality: "videoQualityStandard",
  format: "auto",
  highlight: true,
};
