import { compileArrangement, parse, renderSvg, trimArrangementAtNote } from '../../../src/index.ts';
import { audioLoadMessage } from '../../../src/web/audio-status.ts';
import { translate } from '../../../src/web/i18n.ts';
import type { AudioLoadStatus } from '../../../src/web/soundfont.ts';
import { PreviewAudioPlayer } from '../../../src/web/audio.ts';

const MIN_PREVIEW_PAGE_WIDTH = 280;
const MAX_PREVIEW_PAGE_WIDTH = 1000;
const DEFAULT_VOLUME = 1;
const DEFAULT_PROGRAM = 0;

interface PreviewPayload {
  source: string;
  pageWidth: number | null;
  labels?: {
    play?: string;
    stop?: string;
  };
}

interface PreviewState {
  activeNoteIndices: number[];
  lastPageWidth: number;
}

const previewPlayer = new PreviewAudioPlayer();
let activePreview: { figure: HTMLElement; player: PreviewAudioPlayer } | null = null;

function clampPageWidth(width: number): number {
  return Math.max(MIN_PREVIEW_PAGE_WIDTH, Math.min(MAX_PREVIEW_PAGE_WIDTH, Math.floor(width)));
}

function stageContentWidth(stage: HTMLElement): number {
  const style = window.getComputedStyle(stage);
  const paddingX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
  return clampPageWidth(stage.clientWidth - paddingX);
}

function payloadFor(figure: HTMLElement): PreviewPayload | null {
  const payloadScript = figure.querySelector<HTMLScriptElement>('script[type="application/json"][data-score-preview-source]');
  if (!payloadScript?.textContent) {
    return null;
  }

  try {
    return JSON.parse(payloadScript.textContent) as PreviewPayload;
  } catch {
    return null;
  }
}

function renderPreview(stage: HTMLElement, source: string, pageWidth: number, activeNoteIndices: number[] = []): void {
  const result = parse(source);
  if (!result.ok) {
    return;
  }

  stage.innerHTML = renderSvg(result.value, {
    pageWidth,
    activeNoteIndices,
    color: '#111827',
    background: '#ffffff',
  });
}

function setPlayButtonState(button: HTMLButtonElement | null, payload: PreviewPayload, isPlaying: boolean): void {
  if (!button) {
    return;
  }
  const playLabel = payload.labels?.play ?? 'Play';
  const stopLabel = payload.labels?.stop ?? 'Stop';
  button.textContent = isPlaying ? stopLabel : playLabel;
  button.setAttribute('aria-pressed', String(isPlaying));
}

function showAudioLoadStatus(figure: HTMLElement, status: AudioLoadStatus | null): void {
  const container = figure.querySelector<HTMLElement>('[data-score-preview-loading]');
  const label = container?.querySelector('span');
  const progress = container?.querySelector('progress');
  if (!container || !label || !progress) return;
  container.hidden = status === null;
  if (!status) return;
  const language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';
  label.textContent = audioLoadMessage(status, (key) => translate(language, key));
  progress.setAttribute('aria-label', translate(language, status.phase === 'downloading' ? 'audioDownloading' : 'audioPreparing'));
  if (status.phase === 'downloading' && status.total) {
    progress.max = status.total;
    progress.value = status.loaded;
  } else {
    progress.removeAttribute('value');
    progress.removeAttribute('max');
  }
}

function stopPreview(figure: HTMLElement, payload: PreviewPayload, state: PreviewState, render: () => void): void {
  if (activePreview?.figure !== figure) {
    return;
  }
  activePreview.player.stop();
  activePreview = null;
  state.activeNoteIndices = [];
  setPlayButtonState(figure.querySelector<HTMLButtonElement>('[data-score-preview-play]'), payload, false);
  render();
}

async function playPreview(
  figure: HTMLElement,
  payload: PreviewPayload,
  state: PreviewState,
  render: () => void,
  startNoteIndex = 0,
): Promise<void> {
  const result = parse(payload.source);
  if (!result.ok) {
    return;
  }

  if (activePreview) {
    activePreview.player.stop();
    if (activePreview.figure !== figure) {
      activePreview.figure.dispatchEvent(new CustomEvent('score-preview-stop'));
    }
  }

  const player = previewPlayer;
  activePreview = { figure, player };
  setPlayButtonState(figure.querySelector<HTMLButtonElement>('[data-score-preview-play]'), payload, true);

  const compiled = compileArrangement(result.value, DEFAULT_PROGRAM);
  const arrangement = startNoteIndex === 0 ? compiled : trimArrangementAtNote(compiled, startNoteIndex);
  try {
    await player.play(
      arrangement,
      () => {
        if (activePreview?.player !== player) {
          return;
        }
        activePreview = null;
        state.activeNoteIndices = [];
        setPlayButtonState(figure.querySelector<HTMLButtonElement>('[data-score-preview-play]'), payload, false);
        render();
      },
      (noteIndices) => {
        if (activePreview?.player !== player) {
          return;
        }
        state.activeNoteIndices = noteIndices;
        render();
      },
      DEFAULT_VOLUME,
      (status) => showAudioLoadStatus(figure, status),
    );
  } catch {
    if (activePreview?.figure === figure) stopPreview(figure, payload, state, render);
    window.alert(document.documentElement.lang.startsWith('zh')
      ? '无法加载音频，请检查网络连接后重试。'
      : 'Unable to load audio. Check your connection and try again.');
  }
}

function hydratePreview(figure: HTMLElement): void {
  const stage = figure.querySelector<HTMLElement>('[data-score-preview-stage]');
  const playButton = figure.querySelector<HTMLButtonElement>('[data-score-preview-play]');
  const payload = payloadFor(figure);
  if (!stage || !payload) {
    return;
  }

  const state: PreviewState = {
    activeNoteIndices: [],
    lastPageWidth: 0,
  };
  let frame = 0;
  const update = () => {
    frame = 0;
    const nextPageWidth = payload.pageWidth ?? stageContentWidth(stage);
    if (nextPageWidth === state.lastPageWidth) {
      return;
    }
    state.lastPageWidth = nextPageWidth;
    renderPreview(stage, payload.source, nextPageWidth, state.activeNoteIndices);
  };
  const render = () => renderPreview(stage, payload.source, state.lastPageWidth || (payload.pageWidth ?? stageContentWidth(stage)), state.activeNoteIndices);
  const scheduleUpdate = () => {
    if (frame === 0) {
      frame = window.requestAnimationFrame(update);
    }
  };

  update();
  if (payload.pageWidth === null) {
    new ResizeObserver(scheduleUpdate).observe(stage);
  }
  setPlayButtonState(playButton, payload, false);

  playButton?.addEventListener('click', () => {
    if (activePreview?.figure === figure) {
      stopPreview(figure, payload, state, render);
      return;
    }
    void playPreview(figure, payload, state, render);
  });

  stage.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<SVGGElement>('[data-note-index]') : null;
    const noteIndex = Number(target?.dataset.noteIndex);
    if (Number.isInteger(noteIndex)) {
      void playPreview(figure, payload, state, render, noteIndex);
    }
  });

  figure.addEventListener('score-preview-stop', () => {
    state.activeNoteIndices = [];
    setPlayButtonState(playButton, payload, false);
    render();
  });
}

for (const figure of document.querySelectorAll<HTMLElement>('[data-score-preview]')) {
  hydratePreview(figure);
}
