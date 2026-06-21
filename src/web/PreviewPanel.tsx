import type { MouseEvent, RefObject } from "react";
import type { Document } from "../core/model.js";
import type { TranslationKey } from "./i18n.js";

interface PreviewPanelProps {
  panelRef: RefObject<HTMLElement | null>;
  previewDocument: Document | null;
  pageWidth: number;
  pageWidthModeLabel: string;
  pageCount: number;
  svg: string | null;
  stale: boolean;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  onClickPreview: (event: MouseEvent<HTMLDivElement>) => void;
}

export function PreviewPanel({ panelRef, previewDocument, pageWidth, pageWidthModeLabel, pageCount, svg, stale, t, onClickPreview }: PreviewPanelProps) {
  return (
    <section className="preview-panel" ref={panelRef}>
      <div className="panel-title">
        <h2>{t("preview")}</h2>
        <span>
          {previewDocument
            ? t("previewSummary", {
                lines: previewDocument.score.length,
                width: pageWidth,
                mode: pageWidthModeLabel,
                pages: pageCount,
              })
            : t("noPreview")}
        </span>
      </div>
      <div className="preview-scroll" onClick={onClickPreview}>
        {stale && <p className="preview-notice">{t("stalePreview")}</p>}
        {svg ? <div className="score-svg" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="preview-notice">{t("fixParseErrors")}</p>}
      </div>
    </section>
  );
}
