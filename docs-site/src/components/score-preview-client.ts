import { parse, renderSvg } from '../../../src/index.ts';

const MIN_PREVIEW_PAGE_WIDTH = 280;
const MAX_PREVIEW_PAGE_WIDTH = 1000;

interface PreviewPayload {
  source: string;
  pageWidth: number | null;
}

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

function renderPreview(stage: HTMLElement, source: string, pageWidth: number): void {
  const result = parse(source);
  if (!result.ok) {
    return;
  }

  stage.innerHTML = renderSvg(result.value, {
    pageWidth,
    color: '#111827',
    background: '#ffffff',
  });
}

function hydratePreview(figure: HTMLElement): void {
  const stage = figure.querySelector<HTMLElement>('[data-score-preview-stage]');
  const payload = payloadFor(figure);
  if (!stage || !payload) {
    return;
  }

  let lastPageWidth = 0;
  let frame = 0;
  const update = () => {
    frame = 0;
    const nextPageWidth = payload.pageWidth ?? stageContentWidth(stage);
    if (nextPageWidth === lastPageWidth) {
      return;
    }
    lastPageWidth = nextPageWidth;
    renderPreview(stage, payload.source, nextPageWidth);
  };
  const scheduleUpdate = () => {
    if (frame === 0) {
      frame = window.requestAnimationFrame(update);
    }
  };

  update();
  if (payload.pageWidth === null) {
    new ResizeObserver(scheduleUpdate).observe(stage);
  }
}

for (const figure of document.querySelectorAll<HTMLElement>('[data-score-preview]')) {
  hydratePreview(figure);
}
